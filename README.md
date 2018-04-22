# Runbatch

Simple utility for run multiple instances of one application with template environment and command line.

Very useful for testing purpose.

Template engine - templayed.js

# Install

    npm install -g runbatch

# Usage


## Example 1 (template)

you need to start multiple TCP listeners from 9000 to 9099

    runbatch -c 100 -- nc -l '{{index + 9000}}'

## Example 2 (stuck process)

some process will not close after SIGINT close: specify maximum graceful timeout in ms by `-t, --timeout <ms>`

    runbatch -t 10000 -- app
    # wait for 10 seconds after SIGTERM and then send SIGKILL (terminate)

## Example 3 (fail fast)

if you need stop every processes after first fail (non-zero code) you can use `-f, --fail-fast` flag

    runbatch -f -- nc -l '{{index + 9000}}'
    # if at least one nc not bind then every one are closed

## Example 4 (dynamic environment)

you can set template environment variable by flag `-e, --env [key=value]`

    runbatch -e "NODE_ID={{index}}" -- app
