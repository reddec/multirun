#!/usr/bin/env node
const {cpus} = require('os');
const {spawn} = require('child_process');
const colors = require('colors');
const templayed = require('templayed');
const readline = require('readline');
const program = require('commander');

let cmd, cmdArguments;
program
    .version('1.0.0')
    .arguments('<cmd> [arguments...]')
    .option('-c, --count [n]', 'Number of executables', parseInt, cpus().length * 2)
    .option('-t, --timeout [ms]', 'Graceful shutdown timeout', parseInt, 5000)
    .option('-f, --fail-fast', 'Shutdown every instances if at least one exited', false)
    .option('-e, --env [key=value]', 'Setup additional environment. Also supports template', (arg) => arg.split('=', 2))
    .action((c, a) => {
        cmd = c;
        cmdArguments = a;
    })
    .parse(process.argv);

function pad(num, size) {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

let tasks = [];
let shutdownState = false;
let padding = program.count.toString().length;

function taskExited(task, i, code, signal) {
    tasks[i] = null;
    if (code === null) {
        console.log(`task #${pad(i, padding)} closed by signal ${signal}`.magenta)
    } else {
        let color = code !== 0 ? colors.yellow : colors.green;
        console.log(color(`task #${pad(i, padding)} exited with code ${code}`))
    }
    if (code !== 0 && program.failFast) {
        shutdown();
    }
}

function taskFail(task, i, e) {
    tasks[i] = null;
    console.log("task #", pad(i, padding), "failed:", e);
    if (program.failFast) {
        shutdown();
    }
}

function taskOutLine(task, i, line) {
    console.log(`[task-${pad(i, padding)}] [STDOUT]`.green, line)
}

function taskErrLine(task, i, line) {
    console.log(`[task-${pad(i, padding)}] [STDERR]`.red, line)
}

function taskGracefulTimeout(task, i) {
    console.log(`task ${pad(i, padding)} graceful timeout reached - terminating`.red);
    task.kill('SIGKILL');
}

function shutdown() {
    if (shutdownState) return;
    shutdownState = true;
    console.log("shutdown...");
    tasks.filter((task) => !!task).forEach((task, i) => {
        let gracefull = setTimeout(() => taskGracefulTimeout(task, i), program.timeout);
        task.once('exit', () => clearTimeout(gracefull));
        task.kill('SIGTERM');
    });
}

if (!cmd) {
    console.error('no cmd specified. use --help for description.');
    process.exit(1);
}

for (let i = 0; i < program.count; ++i) {
    console.log("spawn #", i + 1, "child process");
    let env = JSON.parse(JSON.stringify(process.env));
    if (program.env) {
        let key = templayed(program.env[0])({index: i});
        env[key] = templayed(program.env[1])({index: i});
    }
    let args = cmdArguments.map((arg) => templayed(arg)({index: i}));
    let task = spawn(cmd, args, {
        shell: false, // prevent ignoring signals
        detached: false,
        env: env,
    });
    task.once('error', (e) => taskFail(task, i, e));
    task.once('exit', (code, signal) => taskExited(task, i, code, signal));
    const stdout = readline.createInterface({
        input: task.stdout,
        crlfDelay: Infinity
    });
    const stderr = readline.createInterface({
        input: task.stderr,
        crlfDelay: Infinity
    });
    stdout.on('line', (line) => taskOutLine(task, i, line));
    stderr.on('line', (line) => taskErrLine(task, i, line));
    tasks.push(task);
}


process.once('SIGINT', shutdown);