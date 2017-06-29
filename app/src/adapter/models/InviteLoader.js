define(function(require, exports, module) {
    'use strict';

	var raf = require('glympse-adapter/lib/rafUtils');
    var PublicGroup = require('glympse-adapter/adapter/models/PublicGroup');
    var g = glympse;
    var glib = g.lib;


    // Exported class
    function InviteLoader(controller, inviteList, cfg) {

        // State
        var outstandingInviteLookups = 0;
        var requestInfo = "";
        var publicGroupRequests = [];
        var timerPublicGroup = null;

        // Consts

        // Stats Tracking
        var retryAttempts = 0;

        ///////////////////////////////////////////////////////////////////////////////////
        // PROPERTIES
        ///////////////////////////////////////////////////////////////////////////////////



        ///////////////////////////////////////////////////////////////////////////////////
        // PUBLICS
        ///////////////////////////////////////////////////////////////////////////////////

        this.load = function() {
            outstandingInviteLookups = 0;

            var viewType = this.addInvites(cfg.t);

            if(cfg.preload)
            {
                this.addInvites(cfg.preload.invites);
                cfg.preload.invites = null;
                cfg.preload = null;
            }

            //TODO: Add support for TwitterUsers and TwitterTopics
            viewType = this.addGlympseGroups(cfg.pg, viewType);		// Public group handling

        };

        this.addGlympseGroups = function (groups, viewType)
        {
            if (groups)
            {
                viewType = mergeInfoList(viewType, "Glympse Group");

                var pgs = groups.split(delimId);
                var len = pgs.length;

                //outstandingInviteLookups += len;

                for (var i = 0; i < len; i++)
                {
                    var c = generateCfg(pgs[i].split(delimProfile));
                    if (c.id)
                    {
                        requestInfo = mergeInfoList(requestInfo, "!" + c.id);
                        publicGroupRequests.push(new PublicGroup(c, cfg));//profile, inviteLoader.getTrailColor(profile), cfg));
                    }

                    // FIXME: Shouldn't be doing this here
                    g.doFrameUpdate = (!cfg.disableFrameUpdate && cfg.forceFrameUpdate);
                }

                loadNextPublicGroup();
            }

            return viewType;
        };

        this.addInvites = function (invites)
        {
            var viewType = "";

            if (invites)
            {
                var areLoaded = (invites instanceof Array);
                invites = (areLoaded) ? invites : invites.split(delimId);
                var len = invites.length;
                //console.log("areLoaded = " + areLoaded);
                viewType = "Invite";
                outstandingInviteLookups += len;

                for (var i = 0; i < len; i++)
                {
                    var invite = invites[i];
                    var c = generateCfg((areLoaded) ? [invite.invite
                        , (invite.options && invite.options.profile)
                        , (invite.options && (invite.options.trail_color || invite.options.trailColor))
                        , (invite.options && (invite.options.icon_color || invite.options.iconColor))
                        , (invite.options && (invite.options.name_color || invite.options.nameColor))
                        , (invite.options && (invite.options.destination_color || invite.options.destinationColor))
                        , (invite.options && (invite.options.destination_label_color || invite.options.destinationLabelColor))
                    ]
                        : invite.split(delimProfile));

                    listInvites.push(c.id);
                    inviteList.addInvite(c, nextInit);
                }
            }

            return viewType;
        };

        function loadNextPublicGroup()
        {
            var i, j, req, len = publicGroupRequests.length;
            //console.log("****** loadNextPublicGroup -- len=" + len);
            for (i = 0; i < len; i++)
            {
                req = publicGroupRequests[i];
                if (!req.loaded())
                {
                    req.load(processPublicGroupResponse);
                    return;
                }
            }

            // Notify of load before launching invites
            notifyGroupLoaded();

            //console.log("All Public Groups loaded!");
            // Now that all Public Groups->invites are loaded, generate addInvite calls
            var cnt = 0;
            for (i = len - 1; i >= 0; i--)
            {
                req = publicGroupRequests[i];

                var invites = req.getTicketGroup();
                cnt = invites.length;
                outstandingInviteLookups += cnt;
                for (j = cnt - 1; j >= 0; j--)
                {
                    inviteList.addInvite(req.cfgInvite.clone(invites[j]), nextInit);

                    // Allow first one to be smooth -- comment out addGlympseGroups() doFrameUpdate line (222-ish)
                    // FIXME: Shouldn't be doing this here
                    //g.doFrameUpdate = (!cfg.disableFrameUpdate && cfg.forceFrameUpdate);
                }

                // See if we have to remove any
                invites = req.getInviteRemove();
                cnt -= invites.length;
                //console.log("remove=" + tkts.length);
                for (j = invites.length - 1; j >= 0; j--)
                {
                    inviteList.removeInviteById(invites[j]);
                }

                // Set up for the next load
                req.reset();

                if (req.getStopPolling())
                {
                    publicGroupRequests.splice(i, 1);
                }
            }

            // Check if we're empty
            checkGroupUserCount(cnt);

            // Run every X minute(s)
            //console.log("PGrun - " + groupPoll);
            //try
            //{
            //	foo.bar = 00;
            //} catch (e) {
            //	glib.logException(e, arguments); }
            if (publicGroupRequests.length == 0)
            {
                return;
            }

            if (timerPublicGroup)
            {
                raf.clearTimeout(timerPublicGroup);
            }

            timerPublicGroup = raf.setTimeout(loadNextPublicGroup, groupPoll);
        }

        ///////////////////////////////////////////////////////////////////////////////////
        // PRIVATES
        ///////////////////////////////////////////////////////////////////////////////////

        function mergeInfoList(viewType, name)
        {
            return ((viewType) ? (viewType + ",") : "") + name;
        }

        function generateCfg(vals)
        {
            var profile = InviteLoader.getProfile(vals[1], cfg);		// Use local profile first
            profile.requestRoute = controller.requestRoute; // HACK
            return (new g.structs.InviteConfig(cfg, vals[0], profile, vals[2], vals[3], vals[4], vals[5], vals[6]));
        }

        function processPublicGroupResponse(request, noErrors)
        {
            //console.log("processPublicGroupResponse: " + request + " -- NO ERRORS=" + noErrors);
            // Null response means a problem with auth, so back off and retry
            if (!noErrors && request)
            {
                retryAttempts++;

                if (retryAttempts < 10)
                {
                    raf.setTimeout(function()
                    {
                        // FIXME: Sometimes request is "window" and will throw. Repro:
                        // - Start watching empty group
                        // - Send a glympse to empty group to activate the group
                        // - Let run for a bit, then delete the Glympse
                        // - No members should be in the group and request will become null or window
                        try
                        {
                            request.load(processPublicGroupResponse);
                        }
                        catch (e)
                        {
                            loadNextPublicGroup();
                        }
                    }, glib.computeBackoff(retryAttempts));
                }

                return;
            }

            retryAttempts = 0;
            loadNextPublicGroup();
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////
    // STATICS
    ///////////////////////////////////////////////////////////////////////////////////

    // Made available externally for late profile binding (found in loaded group/invite)
    InviteLoader.defaultId = "default";
    InviteLoader.getProfile = function (idProfile, cfg)
    {
        var p = cfg.profiles;//glympse.Profiles.profiles;

        //console.trace("idProfile=" + idProfile);
        idProfile = (idProfile || InviteLoader.defaultId);
        //console.log("idProfile=" + idProfile);

        for (var i = 0; i < p.length; i++)
        {
            var o = p[i];
            //for (var n in o) console.log(i + ": " + n + " = " + o[n] + " -- " + (typeof o[n]));

            if (o.id == idProfile)
            {
                //console.log("o.id:" + o.id + ", iconHtml:" + o.iconHtml);// + ", path:" + o.iconHtml.path);
                if (idProfile == InviteLoader.defaultId || !o.iconHtml || !o.iconHtml.path)
                {
                    // HACK - get this in the general config
                    // REVIEW - most likely not needed
                    var path = ((!o.iconHtml || !o.iconHtml.path) ? null : o.iconHtml.path);
                    if (!o.iconHtml)
                    {
                        o.iconHtml = { path: path, w: 61, h: 61, offX: 30, offY: 30 };
                    }
                }

                o.isDefault = (o.id == InviteLoader.defaultId);
                o.getMessage = InviteLoader.getProfileMessage;	// HACK

                return o;
            }
        }

        // Return back a default profile if the given idProfile doesn't exist
        return InviteLoader.getProfile(null, cfg);
    };

    // Get trail color for a given profile id
    InviteLoader.getTrailColor = function (cfg, profile)
    {
        var clr = (profile) ? profile.color : "39A446";
        //console.log("clr=" + clr + " -- " + profile.color);
        //console.log("PROFILE=", profile);
        //for (var n in profile) console.log(": " + n + " = " + profile[n] + " -- " + (typeof profile[n]));
        if (!profile)
        {
            var p = cfg.profiles;

            for (var i = p.length - 1; i >= 0; i--)
            {
                var o = p[i];
                if (o.id == InviteLoader.defaultId)
                {
                    clr = o.color;
                }
            }
        }

        return (clr.indexOf('rgb') >= 0) ? clr : g.lib.colorCss(clr);	//"#" + glympse.lib.cleanColor(clr);
    };

    InviteLoader.getProfileMessage = function (profile, cfg)
    {
        var msgs = (!profile || !profile.messages || profile.messages.length == 0) ? cfg.loc.msgs : profile.messages;
        //console.log("MSG = " + msgs.length + " -- " + profile.messages + " -- " + profile.id);
        return (msgs[Math.floor(Math.random() * msgs.length)]);
    };



    module.exports = InviteLoader;
});
