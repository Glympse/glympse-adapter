define(function(require, exports, module)
{
	var g = glympse;
    var structs = g.structs;


	InviteList = function (controller)
	{
		// state
		var currentInvite;
		var invites = [];
		var delayLoad = 0;
		var totalPending = 0;

		// consts
		var m = g.MSG;


		///////////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////////

		this.isFirstSelected = function () { return (invites[0] == currentInvite); };
		this.isLastSelected = function () { return (invites[invites.length - 1] == currentInvite); };
		this.getInvites = function () { return invites; };
		this.getCurrent = function () { return currentInvite; };
		this.setCurrent = function (val) { updateCurrentInvite(val); };
		this.getTotalActiveOrPending = function () { return (totalPending + invites.length); };


		///////////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////////

		this.addInvite = function (cfgInvite, callback)
		{
			if (!cfgInvite) return;

			totalPending++;

			var view = controller.notify(m.GetNewInviteView, cfgInvite);

			if (cfgInvite.isBot)
			{
				rafTimeout(function ()
				{
					view.initiateInvite(this, callback);
				}, delayLoad);
				delayLoad += 250;
			}
			else
			{
				// Use the same approach if cfgInvite.isStatic or regular invite id string
				view.initiateInvite(this, callback);
			}
		};

		// FIXME: Add this somewhere else? Still need to coordinate between main controller, a new inviteView and this InviteList
		// ---> Just make a new query type so that InviteView can follow normal path
		this.addLocalInvite = function (locInfo, cfgInvite, callback)
		{
			totalPending++;

			var view = controller.notify(m.GetNewInviteView, cfgInvite);

			rafTimeout(function ()
			{
				var invite = new structs.Ticket(locInfo.id
								, structs.Ticket.STATUS_INACTIVE
								, Math.round((new Date().getTime() - locInfo.created) / 1000)
								, structs.Ticket.TYPE_CHECKIN
								, [ new structs.TrackRecord(new g.LatLng(locInfo.lat, locInfo.lng)) ]
								, {
									name: locInfo.name
									, nameAlt: locInfo.nameAlt
									, avatar: locInfo.avatar
									, msg: locInfo.msg
									, dest: null
									, destName: null
									, destTime: 0
									, route: null
									, eta: 0
									, etaStart: 0
								}
								, -1
								, structs.Ticket.PROVIDER_STATIC
								, cfgInvite.profile
								);
				view.setInvite(invite);
				callback(view);
			}, delayLoad);

			delayLoad += 250;
		};

		this.addViewInvite = function (newViewInvite)
		{
			totalPending--;
			//console.log("active:" + (invites.length + 1) + ", pending:" + totalPending);

			try
			{
				//console.log("addEncoded -- " + invites.length);
				invites.push(newViewInvite);
				//console.log("curr=" + (currentInvite && currentInvite.getInvite().isActive) + ", new=" + newViewInvite.getInvite().isActive);
				// Auto-add first one, or if current focused one is not active and the new invite *is* active
				if (invites.length == 1 || (!currentInvite.getInvite().isActive && newViewInvite.getInvite().isActive))
				{
					updateCurrentInvite(newViewInvite);
				}
				else
				{
					controller.notify(m.InviteListChanged, newViewInvite);
				}
			}
			catch (error)
			{
				g.lib.logException(error, arguments, "ilAddEncoded");
				return false;
			}

			return true;
		};

		this.prev = function ()
		{
			var index = invites.indexOf(currentInvite);
			if (index > 0)
			{
				updateCurrentInvite(invites[index - 1]);
			}
		};

		this.next = function ()
		{
			var index = invites.indexOf(currentInvite);
			if (index < (invites.length - 1))
			{
				updateCurrentInvite(invites[index + 1]);
			}
		};

		this.clearCurrentInvite = function()
		{
			currentInvite = null;
		};

		this.removeInviteById = function (id)
		{
			for (var i = invites.length - 1; i >= 0; i--)
			{
				var invite = invites[i];
				//console.log("lookup: " + invite.getInvite().id + " --> " + id);
				if (invite.getInvite().id == id || id == "*")
				{
					controller.notify(m.InviteRemoved, invite);
					invites.splice(i, 1);
					return true;
				}
			}

			return false;
		};


		///////////////////////////////////////////////////////////////////////////////////
		// INTERNAL
		///////////////////////////////////////////////////////////////////////////////////

		function updateCurrentInvite(newInvite)
		{
			//console.log("update!!");
			if (currentInvite && currentInvite != newInvite)
			{
				currentInvite.deactivate();
			}

			currentInvite = newInvite;
			controller.notify(m.ChangedActiveInvite, newInvite);
		}
	};

	module.exports = InviteList;
});
