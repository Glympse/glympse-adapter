define(function(require, exports, module) {
    'use strict';

    var lib = require('glympse-adapter/lib/utils');
    var g = glympse;

    var Account = require('glympse-adapter/adapter/models/Account');

    // Exported class
    function PublicGroup(cfgInvite, cfg) {
        ///////////////////////////////////////////////////////////////////////////////
        // PROPERTIES
        ///////////////////////////////////////////////////////////////////////////////
    	var svr = cfg.services;
        var idGroup = cfgInvite.id;
        var initialRequest = true;
        var retryAttempts = 0;
        var maxRetryAttempts = 3;
        var accessToken;
        var stopPolling = false;

        var httpHeaders = cfg.requestHeaders;
        var urlEvents = (svr + 'groups/' + idGroup + '/events');
        var urlInitial = (svr + 'groups/' + idGroup );


        ///////////////////////////////////////////////////////////////////////////////
        // PUBLICS
        ///////////////////////////////////////////////////////////////////////////////

        this.load = function(cb) {
            retryAttempts = maxRetryAttempts;
            requestGroup(cb);
        };

        ///////////////////////////////////////////////////////////////////////////////
        // PRIVATE MEMBERS
        ///////////////////////////////////////////////////////////////////////////////

        function requestGroup(cb)
        {
            try
            {
                //console.log('AccessToken=' + accessToken);
                if (!accessToken)
                {
                    //console.log('!!get access token!! -- ' + initialRequest + ' -- ' + retryAttempts);
                    accessToken = g.authService.getAuthToken();
                    updateHttpHeaders();
                    //console.log('AccessToken=' + accessToken + ' -- ' + retryAttempts);
                    //console.log('request token=' + lib.getCookie(tagAuthToken));
                    if (retryAttempts > 0)
                    {
                        $.ajax({
                            url: urlLogin,
                            data: login,
                            dataType: 'json',
                            headers: httpHeaders
                        })
                            .done(function (data)
                            {
                                processLogin(data, callback);
                            })
                            .fail(function (xOptions, status)
                            {
                                console.log('PGLE:' + status);
                                processLogin(null, callback);
                            });

                        return;
                    }
                }

                if (initialRequest)
                {
                    //console.log('::: :: INITIAL REQUEST :: ::: -- ' + idGroup);
                    retryAttempts = 0;

                    var sub = idGroup.toString().toLowerCase();
                    if (sub === 'bryanaroundseattle')
                    {
                        stopPolling = true;
                        //glympse.Profiles.users.splice(1, glympse.Profiles.users.length - 1);
                        cfg.users.splice(1, cfg.length - 1);
                        rafTimeout(function ()
                        {
                            processGroupInitial({ result: 'ok', response: { type: 'group', id: '119', events: 1, members: [{ id: 'DNA7-4HDZ-03WHE', invite: 'demobot0'}], public: true, name: '!BryanTheRussel' }, meta: { code: 200, time: new Date().getTime()} }, callback);
                        }, 200);
                    }
                    else if (sub === 'seattleteam')
                    {
                        stopPolling = true;
                        //glympse.Profiles.users.splice(0, 1);
                        cfg.users.splice(0, 1);
                        rafTimeout(function ()
                        {
                            processGroupInitial({ result: 'ok', response: { type: 'group', id: '119', events: 1, members: [
                                { id: 'DNA7-4HDZ-03WH0', invite: 'demobot0' }
                                , { id: 'DNA7-4HDZ-03WH1', invite: 'demobot1' }
                                , { id: 'DNA7-4HDZ-03WH2', invite: 'demobot2' }
                                , { id: 'DNA7-4HDZ-03WH3', invite: 'demobot3' }
                                , { id: 'DNA7-4HDZ-03WH4', invite: 'demobot4' }
                                , { id: 'DNA7-4HDZ-03WH5', invite: 'demobot5' }
                                , { id: 'DNA7-4HDZ-03WH6', invite: 'demobot6' }
                                , { id: 'DNA7-4HDZ-03WH7', invite: 'demobot7' }
                            ], public: true, name: '!SeattleTeam'
                            }, meta: { code: 200, time: new Date().getTime() }
                            }, callback);
                        }, 200);
                    }
                    else
                    {
                        $.ajax({
                            url: urlInitial,
                            data: urlInitialParams,
                            dataType: 'json',
                            headers: httpHeaders
                        })
                            .done(function(data)
                            {
                                processGroupInitial(data, callback);
                            })
                            .fail(function(xOptions, status)
                            {
                                console.log('PGIE:' + status);
                                processGroupInitial(null, callback);
                            });
                    }
                }
                else
                {
                    //console.log('::: :: EVENTS REQUEST :: :::');
                    $.ajax({
                        url: urlEvents,
                        data: { next: next },
                        dataType: 'json',
                        headers: httpHeaders
                    })
                        .done(function(data)
                        {
                            processGroupUpdate(data, callback);
                        })
                        .fail(function(xOptions, status)
                        {
                            console.log('PGEE:' + status);
                            processGroupUpdate(null, callback);
                        });

                }
            }
            catch (e)
            {
                lib.logException(e, arguments, 'grpRequest');
            }
        }
    }

    // Update auth header with latest accessToken setting
    function updateHttpHeaders()
    {
        delete httpHeaders.Authorization;
        if (!accessToken) return;

        httpHeaders.Authorization = 'Bearer ' + accessToken;
    }

    module.exports = PublicGroup;
});
