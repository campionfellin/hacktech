var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));
var bodyParser = require('body-parser');

var commands = require('./commands');


app.use(express.static(__dirname + '/public'));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.send('hey');
});

app.post('/', function(request, response) {
	console.log(request.body.result);
	//console.log(request.body.result.action); //for just the action
	var action = request.body.result.action;
	console.log(action);
	if (action == "stop") {
		console.log("stopping");
		commands.stop();
	} else if (action == "turn") {
		console.log("turning");
		var direction = request.body.result.parameters.direction;
		var degrees = request.body.result.parameters.degrees;
		commands.turn(direction, degrees);
	} else {
		console.log("moving");
		var direction = request.body.result.parameters.direction;
		var distance = request.body.result.parameters.distance;
		commands.move(direction, distance);
	}
	response.send("Go Dawgs!");
});





app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

