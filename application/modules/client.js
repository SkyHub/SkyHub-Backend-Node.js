var app = require('express')();

var server = require('http').Server(app);
var socket = require('socket.io')(server);

server.listen(3001);

var fs = require('fs');

app.get('/client', function(request, response)){

    console.log("Connected to /client");

    var testCtrl = require('./../application/modules/test/testController.js');

    response.writeHead(200, {"Content-Type" : "text/html"});
    response.write(json(testCtrl.getZZZ()), "utf8");
    response.end();
}