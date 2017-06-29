define(function(require, exports, module)
{
	'use strict';

	var lib = require('glympse-adapter/lib/utils');
	var raf = require('glympse-adapter/lib/rafUtils');
	var ajax = require('glympse-adapter/lib/ajax');

	var Defines = require('glympse-adapter/GlympseAdapterDefines');
	var Account = require('glympse-adapter/adapter/models/Account');

	var m = Defines.MSG;

	// Exported class
	function PublicGroup(controller, account, groupName, cfg)
	{
		///////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////

		//constants
		var dbg = lib.dbg('PublicGroup', cfg.dbg);
		var svr = cfg.svcGlympse;

		var idGroup = encodeURIComponent(groupName);

		var urlEvents = ('groups/' + idGroup + '/events');
		var urlInitial = ('groups/' + idGroup);
		var urlInitialParams = { branding: true };

		//state
		var loaded = false;
		var next = 0;
		var lastUpdate = 0;

		var inviteGroup = [];
		var users = [];
		var inviteRemove = [];

		var that = this;

		this.getTicketGroup = function () { return inviteGroup; };
		this.getInviteRemove = function () { return inviteRemove; };

		///////////////////////////////////////////////////////////////////////////////
		// PUBLIC
		///////////////////////////////////////////////////////////////////////////////

		this.request = function()
		{
			return requestGroup();
		};

		this.setData = function(data)
		{
			if (!data)
			{
				return;
			}
			return processGroupInitial({
				status: true,
				response: data,
				time: Date.now()
			});
		};

		///////////////////////////////////////////////////////////////////////////////
		// PRIVATE MEMBERS
		///////////////////////////////////////////////////////////////////////////////

		function requestGroup()
		{
			var noPolling = false;

			if (!loaded)
			{
				//console.log('::: :: INITIAL REQUEST :: ::: -- ' + idGroup);

				var sub = idGroup.toString().toLowerCase();
				if (sub === 'bryanaroundseattle')
				{
					noPolling = true;

					raf.setTimeout(function()
					{
						processGroupInitial({
							result: 'ok',
							response: {
								type: 'group',
								id: 119,
								events: 1,
								members: [{ id: 'DNA7-4HDZ-03WHE', invite: 'demobot0' }],
								public: true,
								name: '!BryanTheRussel'
							},
							meta: { code: 200, time: new Date().getTime() }
						});
					}, 200);
				}
				else if (sub === 'seattleteam')
				{
					noPolling = true;

					raf.setTimeout(function()
					{
						processGroupInitial({
							result: 'ok',
							response: {
								type: 'group',
								id: 119,
								events: 1,
								members: [
									{ id: 'DNA7-4HDZ-03WH0', invite: 'demobot0' },
									{ id: 'DNA7-4HDZ-03WH1', invite: 'demobot1' },
									{ id: 'DNA7-4HDZ-03WH2', invite: 'demobot2' },
									{ id: 'DNA7-4HDZ-03WH3', invite: 'demobot3' },
									{ id: 'DNA7-4HDZ-03WH4', invite: 'demobot4' },
									{ id: 'DNA7-4HDZ-03WH5', invite: 'demobot5' },
									{ id: 'DNA7-4HDZ-03WH6', invite: 'demobot6' },
									{ id: 'DNA7-4HDZ-03WH7', invite: 'demobot7' }
								],
								public: true,
								name: '!SeattleTeam'
							},
							meta: { code: 200, time: new Date().getTime() }
						}, true);
					}, 200);
				}
				else
				{
					ajax.get(svr + urlInitial, urlInitialParams, account)
						.then(processGroupInitial);
				}
			}
			else
			{
				//console.log('::: :: EVENTS REQUEST :: :::');

				ajax.get(svr + urlEvents, { next: next }, account)
					.then(processGroupUpdate);
			}

			return noPolling;
		}

		// Parse returned initial Glympse Public Group results
		function processGroupInitial(result)
		{
			inviteGroup = [];
			loaded = true; // We're done, even if there is an error

			if (result.status)
			{
				parseGroupListResponse(result);
			}

			controller.notify(m.PG_RequestStatus, result);

			//TODO: probably should sent it later, after all invites are ready
			controller.notify(m.PG_Loaded, result);
		}

		// Parse returned subsequent Glympse Public Group event results
		function processGroupUpdate(result)
		{
			inviteGroup = [];
			inviteRemove = [];
			loaded = true; // We're done, even if there is an error

			//console.log('processGroupUpdate: got data: ' + data + ' -- ' + data.result);
			if (result.status)
			{

				var o = result.response;

				if (o.type === 'group')
				{
					parseGroupListResponse(result);
				}
				else //if (o.type === 'events')
				{
					next = (o.events) ? (o.events + 1) : 0;
					lastUpdate = result.time;
					//console.log('EVENTS next = ' + next);

					// Handle new invites from new/pre-existing clients, and people leaving the group
					if (o.items)
					{
						var user;
						for (var i = o.items.length - 1; i >= 0; i--)
						{
							var item = o.items[i];
							//console.log('UPDATE type=' + item.type);
							if (item.type === 'invite' || item.type === 'swap')
							{
								var inv = item.invite;

								if (item.type === 'swap')
								{
									console.log('GOT A SWAP -- member=' + item.member + ' -- invite=' + item.invite);
								}

								// Queue the new invite code for retrieval
								dbg('ADD', inv);
								inviteGroup.push(inv);

								// See if we already have the user of the new 'invite'
								user = findUser(item.member);
								//console.log('[INVITE]member=' + item.member + '(found=' + (user != null) + ') oldInvite=' + (user && user.invite) + ', newInvite=' + inv);
								if (user)
								{
									// If so, queue to remove the old invite and replace with the new one
									dbg('REMOVE', user.invite);
									inviteRemove.push(user.invite);
									user.invite = inv;
								}
								else
								{
									// Otherwise, they are a new user to track
									users.push({ id: item.member, invite: inv });
								}
							}
							else if (item.type === 'leave')
							{
								//console.log('[LEAVE]member=' + item.member + ' -- found=' + (user != null));
								// If user is leaving, remove their invite and user list entry
								user = findUser(item.member);
								if (user)
								{
									dbg('REMOVE', user.invite);
									inviteRemove.push(user.invite);
									users.splice(users.indexOf(user), 1);
								}
							}
						}
					}
				}
			}

			controller.notify(m.PG_RequestStatus, result);
		}

		function parseGroupListResponse(result)
		{
			var i;
			var o = result.response;

			next = o.events + 1;
			lastUpdate = result.time;

			// Handle inline viewing configuration
			if (o.branding)
			{
				//TODO: pass brand cfg to the viewer
			}

			if (o.members)
			{
				var mbrs = o.members;
				var len = mbrs.length;
				//console.log('members:' + JSON.stringify(mbrs, null, '    '));
				// Sync up existing user list with their current invites
				for (i = users.length - 1; i >= 0; i--)
				{
					var u = users[i];
					for (var j = len - 1; j >= 0; j--)
					{
						var m = mbrs[j];

						if (u.id === m.id)
						{
							// Check if we have a new invite code for an existing user
							if (u.invite !== m.invite)
							{
								dbg('ADD', m.invite);
								inviteGroup.push(m.invite);
								dbg('REMOVE', u.invite);
								inviteRemove.push(u.invite);
							}

							// User still exists in the current list, so don't remove
							u = null;
							break;
						}
					}

					// If not in the new list, remove the user
					if (u)
					{
						dbg('REMOVE', u.invite);
						inviteRemove.push(u.invite);
						users.splice(i, 1);
					}
				}

				// Locate and add any new users
				for (i = len - 1; i >= 0; i--)
				{
					var cli = mbrs[i];

					// Don't add a new user if they already exist in the current user list
					if (findUser(cli.id))
					{
						continue;
					}

					if (cli.invite)
					{
						//console.log('id=' + cli.id + ', invite=' + cli.invite);
						users.push(cli);
						dbg('ADD', cli.invite);
						inviteGroup.push(cli.invite);
					}
				}
			}
		}

		function findUser(id)
		{
			for (var j = users.length - 1; j >= 0; j--)
			{
				var user = users[j];

				if (user.id === id)
				{
					return user;
				}
			}

			return null;
		}
	}


	module.exports = PublicGroup;
});