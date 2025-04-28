# Estrategias de branching que se usaron:

## Estrategia de branching para desarrolladores:
Git Flow
## Estrategia de branching para operaciones:
Release Branch

# Patrones de diseño de nube usados:

## External configuration pattern:
Se uso este patron para que la configuracion de la aplicacion no este directamente codificada en el codigo fuente, sino que en este caso se usa una base de datos externa la cual provee las variables de entorno.

## Retry
En este caso se usa retry cuando se hace el llamado a la base de datos de las variables de entorno, ya que en caso de que este caida o necesite activarse con el primer llamado, se vuelva a intentar hasta que se encuentre disponible o un maximo de 5 intentos.
