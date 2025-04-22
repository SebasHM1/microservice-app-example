package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/avast/retry-go"
	jwt "github.com/dgrijalva/jwt-go"
	"github.com/labstack/echo"
	"github.com/labstack/echo/middleware"
	gommonlog "github.com/labstack/gommon/log"
	_ "github.com/lib/pq"
)

type Config struct {
	ZIPKIN_URL        string
	JWT_SECRET        string
	USERS_API_ADDRESS string
	AUTH_API_PORT     string
	AUTH_API_ADDRESS  string
	TODOS_API_ADDRESS string
	REDIS_PORT        string
	REDIS_HOST        string
	REDIS_CHANNEL     string
}

var AppConfig Config

var (
	// ErrHttpGenericMessage that is returned in general case, details should be logged in such case
	ErrHttpGenericMessage = echo.NewHTTPError(http.StatusInternalServerError, "something went wrong, please try again later")

	// ErrWrongCredentials indicates that login attempt failed because of incorrect login or password
	ErrWrongCredentials = echo.NewHTTPError(http.StatusUnauthorized, "username or password is invalid")

	jwtSecret = "myfancysecret"
)

func loadConfigFromDB(db *sql.DB) error {
	query := "SELECT name, value FROM env"
	rows, err := db.Query(query)
	if err != nil {
		return fmt.Errorf("error querying environment variables: %v", err)
	}
	defer rows.Close()

	configMap := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return fmt.Errorf("error scanning row: %v", err)
		}
		configMap[key] = value
	}

	AppConfig = Config{
		ZIPKIN_URL:        configMap["ZIPKIN_URL"],
		JWT_SECRET:        configMap["JWT_SECRET"],
		USERS_API_ADDRESS: configMap["USERS_API_ADDRESS"],
		AUTH_API_PORT:     configMap["AUTH_API_PORT"],
		AUTH_API_ADDRESS:  configMap["AUTH_API_ADDRESS"],
		TODOS_API_ADDRESS: configMap["TODOS_API_ADDRESS"],
		REDIS_PORT:       configMap["REDIS_PORT"],
		REDIS_HOST:       configMap["REDIS_HOST"],
		REDIS_CHANNEL:     configMap["REDIS_CHANNEL"],
	}

	return nil
}

func connectToDatabase(connStr string) (*sql.DB, error) {
	var db *sql.DB
	err := retry.Do(
		func() error {
			var err error
			db, err = sql.Open("postgres", connStr)
			if err != nil {
				log.Printf("Retrying database connection: %v", err)
				return err
			}
			// Verificar la conexión
			if err = db.Ping(); err != nil {
				log.Printf("Database ping failed: %v", err)
				return err
			}
			return nil
		},
		retry.Attempts(5),          // Número máximo de intentos
		retry.Delay(2*time.Second), // Tiempo entre intentos
		retry.DelayType(retry.FixedDelay),
	)
	return db, err
}

func main() {
	connStr := "postgresql://neondb_owner:npg_qs9gLMJPw4SI@ep-royal-snow-a8u3lgjs-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"
	db, err := connectToDatabase(connStr)
	if err != nil {
		log.Fatalf("Error connecting to the database after retries: %v", err)
	}
	defer db.Close()

	if err := loadConfigFromDB(db); err != nil {
		log.Fatalf("Error loading configuration: %v", err)
	}

	log.Println("Successfully connected to the database")

	hostport := ":" + AppConfig.AUTH_API_PORT
	userAPIAddress := AppConfig.USERS_API_ADDRESS

	envJwtSecret := AppConfig.JWT_SECRET
	if len(envJwtSecret) != 0 {
		jwtSecret = envJwtSecret
	}

	userService := UserService{
		Client:         http.DefaultClient,
		UserAPIAddress: userAPIAddress,
		AllowedUserHashes: map[string]interface{}{
			"admin_admin": nil,
			"johnd_foo":   nil,
			"janed_ddd":   nil,
		},
	}

	e := echo.New()
	e.Logger.SetLevel(gommonlog.INFO)

	if zipkinURL := AppConfig.ZIPKIN_URL; len(zipkinURL) != 0 {
		e.Logger.Infof("init tracing to Zipkit at %s", zipkinURL)

		if tracedMiddleware, tracedClient, err := initTracing(zipkinURL); err == nil {
			e.Use(echo.WrapMiddleware(tracedMiddleware))
			userService.Client = tracedClient
		} else {
			e.Logger.Infof("Zipkin tracer init failed: %s", err.Error())
		}
	} else {
		e.Logger.Infof("Zipkin URL was not provided, tracing is not initialised")
	}

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Route => handler
	e.GET("/version", func(c echo.Context) error {
		return c.String(http.StatusOK, "Auth API, written in Go\n")
	})

	e.POST("/login", getLoginHandler(userService))

	// Start server
	e.Logger.Fatal(e.Start(hostport))
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func getLoginHandler(userService UserService) echo.HandlerFunc {
	f := func(c echo.Context) error {
		requestData := LoginRequest{}
		decoder := json.NewDecoder(c.Request().Body)
		if err := decoder.Decode(&requestData); err != nil {
			log.Printf("could not read credentials from POST body: %s", err.Error())
			return ErrHttpGenericMessage
		}

		ctx := c.Request().Context()
		user, err := userService.Login(ctx, requestData.Username, requestData.Password)
		if err != nil {
			if err != ErrWrongCredentials {
				log.Printf("could not authorize user '%s': %s", requestData.Username, err.Error())
				return ErrHttpGenericMessage
			}

			return ErrWrongCredentials
		}
		token := jwt.New(jwt.SigningMethodHS256)

		// Set claims
		claims := token.Claims.(jwt.MapClaims)
		claims["username"] = user.Username
		claims["firstname"] = user.FirstName
		claims["lastname"] = user.LastName
		claims["role"] = user.Role
		claims["exp"] = time.Now().Add(time.Hour * 72).Unix()

		// Generate encoded token and send it as response.
		t, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			log.Printf("could not generate a JWT token: %s", err.Error())
			return ErrHttpGenericMessage
		}

		return c.JSON(http.StatusOK, map[string]string{
			"accessToken": t,
		})
	}

	return echo.HandlerFunc(f)
}
