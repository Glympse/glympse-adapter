define(function(require, exports, module)
{
    'use strict';

	// Core imports
	var lib = require('glympse-adapter/lib/utils');
	var AdapterDefines = require('glympse-adapter/GlympseAdapterDefines');

	// Test app-specific
	var Defines = require('src-host/Defines');

	var c = Defines.CMD;
	var s = AdapterDefines.STATE;


	// Exported class
	function ViewManager(cfg)
	{
		var dbg = lib.dbg('Host-VM', cfg.dbg);

		// state
		var controller;

		// ui - general
		var divLoading = $('#divLoading');
		var outputText = $('#outputText');
		var uiAdapter = $('#' + cfg.elementAdapter);
		var input = $('#txtInput');


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.init = function(appController)
		{
			controller = appController;
		};

		this.cmd = function(cmd, args)
		{
			switch (cmd)
			{
				case c.InitUi:
				{
					divLoading.hide();
					forceResize();
					break;
				}

				case c.LogEvent:
				{
					logEvent(args.id, args.data);
					break;
				}

				case c.SetAdapterUi:
				{
					$(args).css({ width: '100%', height: '100%' });
					uiAdapter.append(args);
					break;
				}

				default:
				{
					dbg('cmd() - unknown cmd: "' + cmd + '"', args);
					break;
				}
			}

			return null;
		};


		///////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////

		function forceResize()
		{
			// Hack for viewer display
			setTimeout(function()
			{
				$(window).trigger('resize');
			}, 100);
		}

		function logEvent(tag, data)
		{
			var div = $(document.createElement('pre'));
			div.html((tag + ((data === undefined) ? '' : ('\n' + ((typeof data === 'string') ? data : JSON.stringify(data, null, '  '))))).replace(/(,:)/g , '$1&#8203;') + '\n ');
			outputText.append(div);
			outputText.stop().animate({ scrollTop: outputText[0].scrollHeight }, 250);
		}

		function getAppConfig()
		{
			console.log('adapter:', cfg.adapter);
			cfg.adapter.app.getConfig().then(function(data)
			{
				logEvent('[appConfig]', data);
			});
		}

		function doGetValue(param, output, idInterface)
		{
			//cfg.adapter.getValue(param).then(function(data)
			cfg.adapter.map.getInviteProperty({ idProperty: param }).then(function(data)
			{
				if (data === null || data.v === null)
				{
					data = 'null';
				}
				else if (typeof data.v === 'boolean')
				{
					data = data.v.toString();
				}
				else
				{
					data = data.v;
				}

				logEvent('[get' + output + ']', data);
			});
		}

		function doInput(method, output)
		{
			var val = input.val();
			if (val)
			{
				cfg.adapter.map[method](val).then(function(data)
				{
					logEvent('[' + output + '] val=' + val, data);
				});

				input.val('');
			}
			else
			{
				logEvent('[' + output + '] ERROR: Need input!');
			}
		}

		function doInputCore(method, output)
		{
			var val = input.val();
			if (val)
			{
				cfg.adapter.core[method](val).then(function(data)
				{
					logEvent('[' + output + '] val=' + val, data);
				});

				input.val('');
			}
			else
			{
				logEvent('[' + output + '] ERROR: Need input!');
			}
		}

		function removeGroup()
		{
			var val = input.val();
			if (val)
			{
				var params = { name: val, removeInvites: true };
				cfg.adapter.core['removeGroup'](params).then(function(data)
				{
					logEvent('[RemoveGroup] params=' + JSON.stringify(params), data);
				});

				input.val('');
			}
			else
			{
				logEvent('[' + output + '] ERROR: Need input!');
			}
		}

		function clearOutput()
		{
			outputText.empty();
		}

		function refreshView()
		{
			cfg.adapter.map.refreshView().then(function(data)
			{
				logEvent('[Refresh]', data);
			});
		}

		function setPadding()
		{
			var tag = '[Padding]';
			var val = input.val();
			if (val)
			{
				try {
					var padding = JSON.parse(val);
					logEvent(tag + ' isArray:' + (padding instanceof Array) + ', typeof:' + (typeof padding));
					cfg.adapter.map.setPadding(padding).then(function(data)
					{
						logEvent(tag, data);
					});

					input.val('');
				}
				catch (e)
				{
					logEvent(tag + ' ERROR: Invalid padding param: ' + val);
				}
			}
			else
			{
				logEvent(tag + ' ERROR: Need input - integer or 4 integer array');
			}
		}

		function getGroups()
		{
			var tag = '[GetGroups]';
			var val = input.val();

			if (val)
			{
				var groups = val.split(',');
				if (groups.length > 1)
				{
					val = groups;
				}
			}

			cfg.adapter.core.getGroups(val || null).then(function(data)
			{
				logEvent(tag + ' groups: ' + (val || '*all*'), data);
			});

			input.val('');
		}

		function generateClick(id, info)
		{
			return function()
			{
				doGetValue(id, info);
			};
		}

		function generateInput(targ, output)
		{
			return function()
			{
				doInput(targ, output);
			};
		}

		function generateInputCore(targ, output)
		{
			return function()
			{
				doInputCore(targ, output);
			};
		}


		///////////////////////////////////////////////////////////////////////////
		// CALLBACKS
		///////////////////////////////////////////////////////////////////////////


		///////////////////////////////////////////////////////////////////////////
		// INIT
		///////////////////////////////////////////////////////////////////////////

		$('#getArrived').click(generateClick(s.Arrived, 'Arrived'));
		$('#getAvatar').click(generateClick(s.Avatar, 'Avatar'));
		$('#getConfig').click(getAppConfig);
		$('#getDestination').click(generateClick(s.Destination, 'Destination'));
		$('#getEta').click(generateClick(s.Eta, 'ETA'));
		$('#getExpired').click(generateClick(s.Expired, 'Expired'));
		$('#getMessage').click(generateClick(s.Message, 'Message'));
		$('#getName').click(generateClick(s.Name, 'Name'));
		$('#getOwner').click(generateClick(s.Owner, 'Owner'));
		$('#getPhase').click(generateClick(s.Phase, 'Phase'));
		$('#getStartTime').click(generateClick(s.InviteStart, 'Start Time'));
		$('#getEndTime').click(generateClick(s.InviteEnd, 'End Time'));


		// Commands
		$('#addInvite').click(generateInput('addInvites', 'AddInvites'));
		$('#addGroup').click(generateInputCore('addGroup', 'addGroup'));
		$('#addTopic').click(generateInput('addTwitterTopics', 'AddTwitterTopics'));
		$('#addUser').click(generateInput('addTwitterUsers', 'AddTwitterUsers'));
		$('#removeInvite').click(generateInput('removeInvites', 'RemoveInvites'));
		$('#removeGroup').click(removeGroup);
		$('#setApiUrl').click(generateInput('setApiServices', 'SetApiServices'));
		$('#sendRefresh').click(refreshView);
		$('#setPadding').click(setPadding);
		$('#getGroups').click(getGroups);
		$('#btnOutputClear').click(clearOutput);
	}


	module.exports = ViewManager;
});
