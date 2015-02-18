var io = require('socket.io-client');
var EventEmitter = require('eventemitter3');
var util = require('./util');

function Socket(secure, host, port, path, key) {
  if (!(this instanceof Socket)) return new Socket(secure, host, port, path, key);

  EventEmitter.call(this);
  this.disconnected = false;
  this._queue = [];
  this.key = key;

  socketUrl = secure?'https://':'http://';
  socketUrl += host + ':' + port;
  util.log('socketUrl: '+socketUrl);
}

util.inherits(Socket, EventEmitter);

/** Check in with ID or get one from server. */
Socket.prototype.start = function(id, token) {
  this.id = id;
  this.token = token;

  this._startSocket();
}

Socket.prototype._startSocket = function() {
  var self = this;

  if (this._socket) {
    return;
  }

  this._socket = io.connect(socketUrl);

  this._socket.on('connect', function() {
    util.log("Successfully connected(connect)");
    self.disconnected = false;
    /*if (self._timeout) {
      clearTimeout(self._timeout);
      setTimeout(function(){
        self._http.abort();
        self._http = null;
      }, 5000);
    }*/
    self._sendQueuedMessages();

    to_send = {};
    to_send['id'] = self.id;
    to_send['key'] = self.key;
    to_send['token'] = self.token;
    //this._socket.emit('conf', JSON.stringify(to_send));
    util.log("sending conf info");
    self.send(to_send, 'conf');
    
    util.log('Socket open');
  });

  this._socket.on('disconnect', function() {
    util.log('Socket Disconnected!(disconnect)');
    this.disconnected = true;
    self.emit('disconnected');
  });

  this._socket.on('error', function(err) {
    util.log("Error connecting(error): "+err);
    this.disconnected = true;
  });

  this._socket.on('reconnect', function(number) {
    util.log('Reconnected for the '+number+' time (reconnect)');
    this.disconnected = false;
  });

  this._socket.on('reconnect_error', function(err) {
    util.log("Reconnect failed (reconnect_error): "+err);
  });

  this._socket.on('reconnect_failed', function(attempts) {
    util.log('Could not reconnect within '+attempts+' attempts, stopping trying (reconnect_failed)');
  });

  this._socket.on('data', function(message) {
    util.log('Data received(data): '+message);
    var data = '';
    try {
      data = JSON.parse(message);
    } catch(e) {
      util.log('Invalid server message', message);
      return;
    }
    self.emit('message', data);
  });
};

Socket.prototype._sendQueuedMessages = function() {
  for (var i = 0, ii = this._queue.length; i < ii; i += 1) {
    this.send(this._queue[i]);
  }
}

Socket.prototype.send = function(data, type) {
  util.log("Function send with data: '"+data);
  if (this.disconnected) {
    util.log("Disconnected, cannot send");
    return;
  }

  msg_type = type || 'message';

  // If we didn't get an ID yet, we can't yet send anything so we should queue
  // up these messages.
  if (!this.id) {
    this._queue.push(data);
    util.log('Using queue');
    return;
  }

  var message = JSON.stringify(data);
  util.log("Emitting '"+message+"' as type '"+msg_type+"'");
  this._socket.emit(msg_type, message);
}

Socket.prototype.close = function() {
  this._socket.close();
  this.disconnected = true;
}

module.exports = Socket;