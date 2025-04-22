package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"time"

	jwt "github.com/dgrijalva/jwt-go"
	"github.com/sony/gobreaker"
)

var allowedUserHashes = map[string]interface{}{
	"admin_admin": nil,
	"johnd_foo":   nil,
	"janed_ddd":   nil,
}

type User struct {
	Username  string `json:"username"`
	FirstName string `json:"firstname"`
	LastName  string `json:"lastname"`
	Role      string `json:"role"`
}

type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type UserService struct {
	Client            HTTPDoer
	UserAPIAddress    string
	AllowedUserHashes map[string]interface{}
}

// Crear un Circuit Breaker para el servicio de usuarios
var userServiceBreaker *gobreaker.CircuitBreaker

func init() {
	userServiceBreaker = gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "UserServiceCircuitBreaker",
		MaxRequests: 5,                // Máximo de solicitudes permitidas en estado Half-Open
		Interval:    60 * time.Second, // Tiempo para restablecer el contador de fallos
		Timeout:     10 * time.Second, // Tiempo de espera antes de pasar a Half-Open
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			// Cambiar a estado Open si más del 50% de las solicitudes fallan
			return counts.ConsecutiveFailures > 3
		},
	})
}

func (h *UserService) Login(ctx context.Context, username, password string) (User, error) {
	var user User

	// Usar el Circuit Breaker para la llamada al servicio de usuarios
	result, err := userServiceBreaker.Execute(func() (interface{}, error) {
		user, err := h.getUser(ctx, username)
		if err != nil {
			return nil, err
		}

		userKey := fmt.Sprintf("%s_%s", username, password)

		if _, ok := h.AllowedUserHashes[userKey]; !ok {
			return nil, ErrWrongCredentials
		}

		return user, nil
	})

	if err != nil {
		// Si el Circuit Breaker está abierto o la llamada falla, manejar el error
		log.Printf("Circuit breaker triggered for user service: %v", err)
		return user, err
	}

	// Retornar el resultado si la llamada fue exitosa
	return result.(User), nil
}

func (h *UserService) getUser(ctx context.Context, username string) (User, error) {
	var user User

	token, err := h.getUserAPIToken(username)
	if err != nil {
		return user, err
	}
	url := fmt.Sprintf("%s/users/%s", h.UserAPIAddress, username)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Add("Authorization", "Bearer "+token)

	req = req.WithContext(ctx)

	resp, err := h.Client.Do(req)
	if err != nil {
		return user, err
	}

	defer resp.Body.Close()
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return user, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return user, fmt.Errorf("could not get user data: %s", string(bodyBytes))
	}

	err = json.Unmarshal(bodyBytes, &user)

	return user, err
}

func (h *UserService) getUserAPIToken(username string) (string, error) {
	token := jwt.New(jwt.SigningMethodHS256)
	claims := token.Claims.(jwt.MapClaims)
	claims["username"] = username
	claims["scope"] = "read"
	return token.SignedString([]byte(jwtSecret))
}
