#[Changelog] glympse-adapter

version |date        |notes
:-------|:-----------|:------
2.11.1  | 2017/12/19 | Bugfix: de-duplicate invite's data-stream.
2.11.0  | 2017/10/06 | Added waypoints support for `core.getEtaInfo` API. 
2.10.0  | 2017/09/08 | BugFix for handling public group events (cleanup the events queue before processing).
2.9.0   | 2017/08/01 | BugFix for auth requests. New `core.getEtaInfo` endpoint + `EtaInfo` event.
2.8.1   | 2017/07/19 | New `ViewerZoomChanged` event + bot group options
2.7.2   | 2017/07/17 | Missing auth / removed ticket invite bugfixes
2.7.1   | 2017/07/12 | Propagate app info through to viewer
2.7.0   | 2017/07/12 | Add removeGroup and getGroups APIs for additional handling of Glympse public groups + various bugfixes.
2.6.0   | 2017/07/05 | Add support for loading Glympse public groups directly in the adapter.
Client must currently manage invites (i.e. manually add/remove them on the map -- see examples)
2.5.0   | 2017/06/30 | Update all api calls to send adapter/hosting app name and version
2.4.0   | 2017/06/17 | New events, better token caching, https consistency, updated examples, new app interface
2.3.2   | 2017/04/27 | Fix for removing first ticket invite from card
2.3.1   | 2017/04/06 | Additional handling for expired/invalided auth tokens
2.3.0   | 2017/03/10 | `hostQueueMaxSize` option: 0 = disable host message queue, <0 = no limit, >0 = limit to first N events
2.2.0   | 2017/03/07 | Change default viewer version to "stable"
2.1.2   | 2017/03/07 | Bug fix for ticket-only events
2.1.0/1 | 2017/02/26 | Cleaned up support for `sandbox=1` setting. Removed `svcCards` setting (only `svcGlympse` is necessary now). Point to correct viewer base URL.
2.0.2	| 2017/02/17 | Add `invitee` property on the Card model for proper handling of *card_request* invite types
2.0.1	| 2017/02/15 | Updated to use LocalStorage instead of cookies, if available
2.0.0   | 2017/02/10 | Revamp of internal architecture + addition of Glympse Cards APIs. Biggest imact for ticket invite usage: must specify apiKey param and set isAnon=true config setting for regular viewing of ticket invites.
1.4.2   | 2016/11/12 | *InviteClicked* event propagation fix
1.4.1   | 2016/11/09 | Add *InviteClicked* event
1.4.0   | 2016/11/08 | Remove `adapter.getViewer()`, add client-only `adapter.map.getMapContainer()` method
1.3.10  | 2016/07/23 | Expire option for `setCfgVal()`: `lib.setCfgVal(name, val, daysExpire)` _(default: 365)_
...     | ...        | **\[ _Need to pull in from tagged version release notes, as available_ \]**
1.0.0   | 2015/08/11 | Initial release
