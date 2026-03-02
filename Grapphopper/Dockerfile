FROM eclipse-temurin:21-jre

WORKDIR /app

RUN apt-get update && apt-get install -y wget && \
    wget https://repo1.maven.org/maven2/com/graphhopper/graphhopper-web/9.0/graphhopper-web-9.0.jar -O graphhopper.jar

EXPOSE 8989
ENTRYPOINT ["java", "-Xmx4g", "-Xms4g", "-jar", "/app/graphhopper.jar", "server", "Config.yaml"]