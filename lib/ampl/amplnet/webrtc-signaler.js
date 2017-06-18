'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Listen to peergroup, and when it adds a peer, listen to that peer
// so that we can tell others about it when it connects / disconnects.
var WebRTCSignaler = function () {
  // todo: should this have the peergroup or should the peergroup listen to it?
  function WebRTCSignaler(peergroup) {
    var _this = this;

    _classCallCheck(this, WebRTCSignaler);

    peergroup.on('peer', function (peer) {
      // XXX fix this too
      if (peer.self == true) {
        _this.SELF = peer;
      }

      peer.on('connect', function () {
        _this.broadcastKnownPeers();
      });
      peer.on('disconnect', function () {
        // XXX: orion, why do we broadcast disconnects?
        _this.broadcastKnownPeers();
      });

      peer.on('message', function (m) {
        if (m.knownPeers) {
          _this.locatePeersThroughFriends(peer, m.knownPeers);
        }

        if (m.action) {
          // we only care about 'action'-carrying messages, which are signals.
          _this.routeSignal(peer, m);
        }
      });
    });

    this.peergroup = peergroup;
  }

  // whenever anyone connects or disconnects we tell everyone everything.


  _createClass(WebRTCSignaler, [{
    key: 'broadcastKnownPeers',
    value: function broadcastKnownPeers() {
      var _this2 = this;

      this.peergroup.peers().forEach(function (peer) {
        var connectedPeerIds = _this2.peergroup.peers().filter(function (p) {
          return p.connected;
        }).map(function (p) {
          peer.id;
        });
        console.log("Broadcasting known peers to " + peer.id, connectedPeerIds);
        peer.send({ knownPeers: connectedPeerIds });
      });
    }
  }, {
    key: 'locatePeersThroughFriends',
    value: function locatePeersThroughFriends(peer, knownPeers) {
      var _this3 = this;

      var ids = Object.keys(knownPeers);

      var _loop = function _loop(i) {
        var remotePeerId = ids[i];
        if (!(remotePeerId in _this3.peerStats) && remotePeerId < _this3.SELF.id) {
          // fake a hello message
          var msg = { action: "hello", session: ids[i], name: knownPeers[remotePeerId].name
            // process the hello message to get the offer material
          };_this3.peergroup.processSignal(msg, undefined, function (offer) {
            // send the exact same offer through the system
            var offerMsg = { action: "offer", name: _this3.SELF.name, session: _this3.SELF.id, doc_id: _this3.doc_id, to: remotePeerId, body: offer };
            peer.send(offerMsg);
          });
        }
      };

      for (var i in ids) {
        _loop(i);
      }
    }
  }, {
    key: 'handleSignal',
    value: function handleSignal(peer, m) {
      var _this4 = this;

      this.peergroup.processSignal(m, m.body, function (reply) {
        if (m.action == "offer") {
          var replyMsg = {
            action: "reply",
            name: _this4.SELF.name,
            session: _this4.SELF.id,
            doc_id: _this4.doc_id,
            to: m.session,
            body: reply
          };
          peer.send(replyMsg);
        }
      });
    }

    // note that this forwarding logic only works in a highly connected network;
    // if you're not connected to the peer it is bound for, this won't work.

  }, {
    key: 'forwardSignal',
    value: function forwardSignal(peer, m) {
      // this is inefficient; todo: look up the peer by id
      this.peergroup.peers().forEach(function (p) {
        if (p.id == m.to) {
          p.send(m);
        }
      });
    }

    // When we get a signal, send it to everyone else unless it's for us, in which case process it.

  }, {
    key: 'routeSignal',
    value: function routeSignal(peer, m) {
      if (m.to == this.SELF.id) {
        this.handleSignal(peer, m);
      } else {
        this.forwardSignal(peer, m);
      }
    }
  }]);

  return WebRTCSignaler;
}();