// Generated by CoffeeScript 1.9.3
var CONFIG_DIR, PORT, SUFFIXES, async, dnsServer, express, forward, fs, handle, httpProxy, httpServer, proxy, readConfig, ref, request, serve, server, staticMiddlewares, upgrade;

async = require('async');

express = require('express');

fs = require('fs');

httpProxy = require('http-proxy');

request = require('request');

CONFIG_DIR = process.env.HOME + "/.mehserve";

PORT = (ref = process.env.PORT) != null ? ref : 12439;

SUFFIXES = [".dev", ".meh"];

readConfig = function(req, res, next) {
  return async.waterfall([
    function(done) {
      var endOfHost, host, j, len, suffix;
      host = req.headers.host;
      for (j = 0, len = SUFFIXES.length; j < len; j++) {
        suffix = SUFFIXES[j];
        endOfHost = host.substr(host.length - suffix.length);
        if (endOfHost.toLowerCase() === suffix.toLowerCase()) {
          host = host.substr(0, host.length - suffix.length);
          break;
        }
      }
      return done(null, host);
    }, function(host, done) {
      var exists, i, j, options, ref1, split;
      split = host.split(".");
      options = [];
      for (i = j = 0, ref1 = split.length; 0 <= ref1 ? j < ref1 : j > ref1; i = 0 <= ref1 ? ++j : --j) {
        options.push(split.slice(split.length - i - 1).join("."));
      }
      options.push("default");
      exists = function(option, done) {
        return fs.exists(CONFIG_DIR + "/" + option, done);
      };
      return async.detectSeries(options, exists, function(configName) {
        var err;
        if (configName) {
          return done(null, configName);
        }
        err = new Error("Configuration not found");
        err.code = 500;
        return done(err);
      });
    }, function(configName, done) {
      return fs.stat(CONFIG_DIR + "/" + configName, function(err, stats) {
        return done(err, configName, stats);
      });
    }, function(configName, stats, done) {
      var config, contents, lines;
      if (stats.isDirectory()) {
        config = {
          type: 'static',
          path: CONFIG_DIR + "/" + configName
        };
      } else {
        contents = fs.readFileSync(CONFIG_DIR + "/" + configName, 'utf8');
        if (contents[0] === "{") {
          config = JSON.parse(contents);
        } else {
          lines = contents.split("\n");
          if (lines[0].match(/^[0-9]+$/)) {
            config = {
              type: 'port',
              port: parseInt(lines[0], 10)
            };
          } else if (lines[0].match(/^\//)) {
            config = {
              type: 'static',
              path: "" + lines[0]
            };
          } else {
            config = {};
          }
        }
      }
      return done(null, config);
    }
  ], function(err, config) {
    if (err) {
      return next(err);
    }
    req.config = config;
    return next();
  });
};

handle = function(req, res, next) {
  var err;
  if (req.config.type === 'port') {
    return forward(req, res, next);
  } else if (req.config.type === 'static') {
    return serve(req, res, next);
  } else {
    err = new Error("Config not understood");
    err.code = 500;
    err.meta = req.config;
    return next(err);
  }
};

staticMiddlewares = {};

serve = function(req, res, next) {
  var config, path;
  config = req.config;
  path = config.path;
  if (staticMiddlewares[path] == null) {
    staticMiddlewares[path] = express["static"](path);
  }
  return staticMiddlewares[path](req, res, next);
};

proxy = httpProxy.createProxyServer({
  host: "localhost",
  ws: true
});

forward = function(req, res, next) {
  var config, port;
  config = req.config;
  port = config.port;
  return proxy.web(req, res, {
    target: {
      port: port
    }
  }, next);
};

upgrade = function(req, socket, head) {
  return readConfig(req, null, function(err) {
    var config, port;
    if (err) {
      return socket.close();
    }
    config = req.config;
    port = config.port;
    return proxy.ws(req, socket, head, {
      target: {
        port: port
      }
    });
  });
};

server = express();

server.use(readConfig);

server.use(handle);

httpServer = server.listen(PORT, function() {
  var port;
  return port = httpServer.address().port;
});

httpServer.on('upgrade', upgrade);

dnsServer = require('./dnsserver');

dnsServer.serve(15353);

//# sourceMappingURL=index.js.map
