// App entry point
define(function(require, exports, module)
{
    'use strict';

	// imports
	var lib = require('glympse-adapter/lib/utils');
	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var Oasis = require('oasis');


	function Host(controller, oasisLocal, cfg)
	{
		var cfgApp = (cfg && cfg.app) || {};
		var cfgAdapter = (cfg && cfg.adapter) || {};

		var dbg = lib.dbg('Host', cfgApp.dbg);

		// state
		var port;
		var sandbox;

		var callbackInitialized;	// Channel created
		var callbackConnected;		// Channel established


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function(settings)
		{
			callbackInitialized = settings.initialize;
			callbackConnected = settings.connect;

			var events = settings.events || {};
			events.Connected = connect;

			var idPort = Defines.PORT;
			var cfgSandbox = { url: settings.url,
							   type: 'html',
							   capabilities: [ idPort ],
							   services: { }
							 };

			cfgSandbox.services[idPort] = Oasis.Service.extend(
				{
					initialize: initialize,
					events: events,
					requests:
					{
						getInfo: requestGetInfo
						//, ping: requestPing
					}
				});

			sandbox = oasisLocal.createSandbox(cfgSandbox);

			return sandbox.el;
		};


		///////////////////////////////////////////////////////////////////////////////
		// INTERNAL
		///////////////////////////////////////////////////////////////////////////////

		function initialize(newPort, name)
		{
			port = newPort;

			//dbg('GlympseHost initialized --- "' + name + '"');
			if (callbackInitialized)
			{
				callbackInitialized(name);
			}
		}

		function connect(data)
		{
			//dbg('GlympseHost connect --- data', data);
			//port = sandbox.capabilities[Defines.PORT];

			dbg('clientConnected: "' + data.id + '" v(' + data.version + ')');
			var interfaceTypes = [ 'map', 'card', 'core', 'ext', 'app' ];

			// Generate API endpoints on main GA instance based on
			// the advertised interfaces from the client
			for (var i = 0, len = interfaceTypes.length; i < len; i++)
			{
				var intType = interfaceTypes[i];
				var interfaces = (data && data[intType]);

				if (interfaces)
				{
					for (var j = 0, jlen = interfaces.length; j < jlen; j++)
					{
						var id = interfaces[j];
						controller[intType][id] = generateCustomInterface(intType, id);
					}
				}
			}

			if (callbackConnected)
			{
				callbackConnected(data);
			}
		}

		function requestGetInfo(infoType)
		{
			dbg('[request.getInfo]', infoType);
			switch (infoType)
			{
				default:
				{
					return { error: 'Unknown infoType "' + infoType + '"' };
				}
			}
		}

		function generateCustomInterface(intType, id)
		{
			var request = { id: id, args: null };

			return function(args)
			{
				request.args = args;
				return port.request(intType, request);
			};
		}

/*		function requestPing(str)
		{
			return new Oasis.RSVP.Promise(function(resolve, reject)
			{
				var delay = 100;
				setTimeout(function()
				{
					resolve('PONG - ' + str + ' (delayed ' + delay + 'ms)');
				}, delay);
			});
		}*/
	}


	module.exports = Host;
});
