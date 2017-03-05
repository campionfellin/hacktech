var express = require('express');
var app = express();
var request = require('request');
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));
var server = app.listen(3000, () => {
    console.log('Example app listening on port 3000!')
});
app.use(express.static('public'))

var io = require('socket.io')(server);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

var headers = {
    'User-Agent': 'Super Agent/0.0.1',
    'Content-Type': 'application/x-www-form-urlencoded'
}
var timer;

function clearTimer() {
    if (timer) {
        clearTimeout(timer);
        timer = 0;
    }
}
var ignore;
app.post('/', function (req, res) {
    // angle
    // cliffLeft, cliffFrontLeft, cliffFrontRight, cliffRight
    // bumpLeft, bumpRight
    // dropLeft, dropRight
    // wall (doesn't work)
    // velocity of each drive wheel
    // left/right encoder counts
    // res.json({ status: "success" });
    // console.log('req.body:', req.body);
    io.emit('data has been sent', req.body);
    if ((req.body.bumpLeft == "true" || req.body.bumpRight == "true") && !ignore) {
        ignore = true;
        robot.driveSpeed(-100, -100);

        timer=setTimeout(function() {
            robot.drive(0, 0);
            console.log("I was bumped!");
            clearTimer();
            if (req.body.bumpLeft == "true") {
                robot.driveSpeed(100, -100);
            } else {
                robot.driveSpeed(-100, 100);
            }
            timer = setTimeout(function() {
                ignore = false;
                robot.drive(0, 0);
            }, (90/55)*1000);
        }, 500);
        
    }
});


var create = require('create2');
var robot, turnRobot, stopTurn;

var options = {
    url: 'http://localhost:3000',
    method: 'POST',
    headers: headers,
    form: {
        distance: 0,
        angle: 0,
        battery: 0,
        cliffLeft: false,
        cliffFrontLeft: false,
        cliffFromRight: false,
        cliffRight: false,
        bumpLeft: false,
        bumpRight: false,
        lightBumpLeft: false,
        lightBumpFrontLeft: false,
        lightBumpCenterLeft: false,
        lightBumpCenterRight: false,
        lightBumpFrontRight: false,
        lightBumpRight: false,
        wall: false, // unnecessary
        velocity: 0,
        leftEncoder: 0,
        rightEncoder: 0,
    }
}

app.get('/currentPos', function (req, res) {
    res.json(options.form);
});

function start() {
    create.prompt(function (p) { create.open(p, main) });
}

var driveStraight = 32768;

//Main Program:
function main(r) {



    console.log("In here");

    robot = r; handleInput(robot);

    //Enter full Mode:
    robot.full(); var run = 1;



    //setTimeout(function(){robot.showText("Hello World!", 500, true)}, 500);

    //We'll play this song whenever entering user-control:
    // robot.setSong(0, [[72,32],[76,32],[79,32],[72,32]]);

    //Handle First onChange:
    robot.onChange = function () {
        if (robot.data.charger || robot.data.docked) { robot.start(); run = 0; }
        else {
            //  robot.play(0);
            // driveLogic();
        } robot.onChange = onchange;
    }

    //Handle onChange Events:
    function onchange(chg) {


        if (robot.data.mode == 3 && run == 1) { //full mode:

            //lightBumper is a macro for all light bump sensors (lightBumpLeft, lightBumpRight, etc)
            //Unfortunately, no similar macro exists for cliff sensors or bumper switches due to the way the data is delivered.
            options.form.bumpLeft = chg.bumpLeft || false;
            options.form.bumpRight = chg.bumpRight || false;
            options.form.cliffLeft = chg.cliffLeft || false;
            options.form.cliffFrontLeft = chg.cliffFrontLeft || false;
            options.form.cliffFrontRight = chg.cliffFrontRight || false;
            options.form.cliffRight = chg.cliffRight || false;
            options.form.dropLeft = chg.dropLeft || false;
            options.form.dropRight = chg.dropRight || false;
            options.form.leftEncoder = robot.data.encoderLeft || 0;
            options.form.rightEncoder = robot.data.encoderRight || 0;
            options.form.lightBumpLeft = chg.lightBumpLeft || false;
            options.form.lightBumpFrontLeft = chg.lightBumpFrontLeft || false;
            options.form.lightBumpCenterLeft = chg.lightBumpCenterLeft || false;
            options.form.lightBumpCenterRight = chg.lightBumpCenterRight || false;
            options.form.lightBumpRight = chg.lightBumpRight || false;
            options.form.chargeState = String(Math.round((robot.data.charge / robot.data.maxCharge) * 100)) + "%" || 0;
            options.form.isCharging = robot.data.chargeState;
            // console.log(robot.data)

            // send data after all possible changes
            request(options, function (error, response, body) {
                // console.log('sending data');
                if (!error && response.statusCode == 200) {
                    // Print out the response body
                    console.log(body)
                }
                if (error) console.log(error)
            });



            //Charging Station Detected! Since it's in front of the robot anyway... Start Auto-Docking!
            if (robot.data.irLeft == 172 || robot.data.irRight == 172) {
                robot.drive(0, 0); run = -1; robot.showText("SEEK", 500, false, robot.autoDock);
            }
        } else if (robot.data.mode == 1) { //PASSIVE mode:
            if (chg.clean && robot.data.clean) { //Clean Pressed:
                if (robot.data.docked) robot.clean(); //Start backing up if clean pressed while docked.
                else preventDefault(function () { run = 1; driveLogic() }); //Prevent default.
            }
            if (chg.docked && robot.data.docked) { //Robot Docked:
                setUndock(0); robot.full(); robot.showText("DOCK", 500, false, robot.start);
            } else if (chg.docked/* && !robot.data.charger*/ && !robot.data.docked) { //Robot Undocked:
                setUndock(1);
            } else if (chg.dropLeft || chg.dropRight) { //Docking Interrupted:
                if (run == -1) { robot.full(); robot.showText("RST", 500, false, robot.autoDock) }
                //else setUndock(1);
            }
        }
    }

    //Logic to Start and Stop Moving Robot:
    function driveLogic() {
        console.log('MOVING')
        //We're in user-control (full mode) and can control the robot. (Your main program would be here!)
        if (robot.data.lightBumper || robot.data.bumpLeft || robot.data.bumpRight) robot.driveSpeed(0, 0); //Disable motors.
        else robot.driveSpeed(robot.data.dropLeft ? 0 : 100, robot.data.dropRight ? 0 : 100); //Enable motors if wheels are up.
        if (robot.data.clean || robot.data.docked) { robot.driveSpeed(0, 0); robot.start() } //Back to PASSIVE mode.
        // console.log('r data:', r.data);
        // robot.drive(300, driveStraight);
    }

    //Enable and disable undocking timer:
    var dTmr; function setUndock(e) {
        if (dTmr) clearTimeout(dTmr); //Cancel timer if already running.
        if (e) {
            run = 1; robot.start(); dTmr = setTimeout(function () {
                robot.full(); run = 1; dTmr = setTimeout(function () {
                    robot.showText
                    ("UNDOCK", 250, true);
                    // robot.play(0);
                    driveLogic(); dTmr = null
                }, 250);
            }, 4400);
        } else run = 0;
    }

    //Turns robot when 't' is pressed:
    var drRun = 0, drAngle = 0;
    turnRobot = function () {
        if (robot.data.mode == 3 && drRun) { //If already turning:
            run = 0; if (drAngle) drAngle = 0; else //Set desired angle to original angle.
                drAngle = (robot.motorRad == 1) ? 64 : -64; //Continue in current motor direction.
            robot.drive(100, (drAngle - angle < 0) ? -1 : 1); drRun = 1;
        } else if (robot.data.mode == 3 && run == 1) { //Start new turn in opposite direction:
            run = 0; drAngle = drAngle < 0 ? 64 : -64; angle = 0; drRun = 1;
            robot.drive(100, (drAngle - angle < 0) ? -1 : 1);
        }
    }

    //Stop turning when 's' is pressed:
    stopTurn = function () {
        if (robot.data.mode == 3 && drRun) { //If already turning:
            run = 1; drRun = 0; //driveLogic(); //Stop turn.
        }
    }

    var angle = 0; //Count Angle Changes Using Encoders:
    var distance = 0;
    robot.onMotion = function () {
        angle += robot.delta.angle; console.log("Angle:", angle);
        distance  += robot.delta.distance; console.log("Distance:", distance);

        options.form.angle = angle;
        options.form.distance =  distance;
        var data = { angle: angle, distance: distance }
        // io.emit('angle distance changed', data);
        request(options, function (error, response, body) {
            console.log('sending request')
            if (!error && response.statusCode == 200) {
                // Print out the response body
                console.log(body)
            }
        });


        if (((drAngle >= 0 && angle >= drAngle) || (drAngle < 0 && angle
            <= drAngle)) && drRun) { drRun = 0; run = 1; driveLogic(); }
    }

    // Prevent Default Behavior of Buttons in Passive Mode:
    function preventDefault(func) {
        setTimeout(function () { robot.full(); if (func) setTimeout(func, 500) }, 1400);
    }

    io.on('connection', (socket) => {
        console.log('a user connected');

        socket.on('disconnect', () => {
            console.log('user disconnected');
        });

        // socket.on('reset-robot', () => {
        //     console.log('reset robot')
        //     options = {
        //         url: 'http://localhost:3000',
        //         method: 'POST',
        //         headers: headers,
        //         form: {
        //             distance: 0,
        //             angle: 0,
        //             battery: 0,
        //             cliffLeft: false,
        //             cliffFrontLeft: false,
        //             cliffFromRight: false,
        //             cliffRight: false,
        //             bumpLeft: false,
        //             bumpRight: false,
        //             chargeState: 0,
        //             lightBumpLeft: false,
        //             lightBumpFrontLeft: false,
        //             lightBumpCenterLeft: false,
        //             lightBumpCenterRight: false,
        //             lightBumpFrontRight: false,
        //             lightBumpRight: false,
        //             wall: false, // unnecessary
        //             velocity: 0,
        //             leftEncoder: 0,
        //             rightEncoder: 0,
        //         }
        //     }
        // })   

        socket.on('move-up', () => {
            console.log('move up');
            robot.drive(100, 32767);
        });

        socket.on('turn-left', () => {
            console.log('turn left');
            // turnRobot();
            robot.driveSpeed(-100, 100);
            setTimeout(function() {
				robot.drive(0, 0);
			}, (90 / 55)*1000);
        })

        socket.on('turn-right', () => {
            console.log('turn right')
            // turnRobot();
            robot.driveSpeed(100, -100);
            setTimeout(function() {
				robot.drive(0, 0);
			}, (90 / 55)*1000);
        });

        // backwards
        socket.on('go-back', () => {
            robot.driveSpeed(-100, -100);
        });
        //robot.driveSpeed(-100, -100);

        socket.on('stop-turning', () => {
            console.log('stop turn')
            robot.driveSpeed(0, 0); 
        })

        socket.on('stop-moving', () => {
            console.log('stop moving');
            robot.driveSpeed(0, 0);
        })
        
    });
}

function handleInput(robot) {
    //Process user input, quit on 'exit'
    const rl = require('readline').createInterface
        ({ input: process.stdin, output: process.stdout });
    rl.on('line', function (text) {
        if (text == "exit" || text == "quit") {
            console.log("Exiting..."); process.exit();
        } else if (text == "t") {
            turnRobot(); //Turn Robot.
        } else if (text == "s") {
            stopTurn(); //Stop Turning.
        } else if (text == "b") {
            console.log(robot.data.charge / robot.data.maxCharge * 100);
        }
    });
}

start();