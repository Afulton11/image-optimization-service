# Lambda Layers / Sharp

Builds a lambda layer that contains the npm sharp package and its related binaries for arm64 lambdas.

Mostly from layers/sharp: <https://github.com/pH200/sharp-layer/blob/master/.github/workflows/build.yml>

- Without this, Lambda becomes frustrated, unable to find the sharp module and its binaries...
