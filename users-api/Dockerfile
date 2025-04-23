FROM openjdk:8-jdk-alpine

WORKDIR /app

COPY .mvn .mvn
COPY mvnw /app/mvnw
COPY pom.xml /app/pom.xml

RUN ls -l /app
# Install dos2unix to convert line endings and ensure compatibility
RUN apk add --no-cache dos2unix && dos2unix /app/mvnw
# Make the Maven wrapper script executable
RUN chmod +x /app/mvnw

COPY src /app/src

RUN /app/mvnw clean package -DskipTests

EXPOSE 8083

CMD ["java", "-jar", "/app/target/users-api-0.0.1-SNAPSHOT.jar"]