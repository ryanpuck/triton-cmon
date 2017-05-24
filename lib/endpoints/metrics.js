/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2017 Joyent, Inc.
 */

// jsl:ignore
'use strict';
// jsl:end

var mod_assert = require('assert-plus');
var mod_restify = require('restify');

var lib_errors = require('../errors');

function apiGetMetrics(req, res, next) {
    var serverCacheItem, admin_ip, cmon_agent_url, cmon_agent_path, client;

    var target_uuid = req.header('HOST').split('.')[0];
    var cache = req.app.cache;
    mod_assert.object(cache, 'cache object');

    if (cache.admin_ips.has(target_uuid)) {
        serverCacheItem = cache.admin_ips.get(target_uuid);
        mod_assert.object(serverCacheItem, 'admin ip cache obj');

        admin_ip = serverCacheItem.admin_ip;
        mod_assert.string(admin_ip, 'admin_ip');

        cmon_agent_url = 'http://' + admin_ip + ':9163';
        cmon_agent_path = '/v1/gz/metrics';
        client = mod_restify.createStringClient({ url: cmon_agent_url });
        client.get(cmon_agent_path, function _cnFetch(err, req2, res2, data2) {
            if (err) {
                req.log.error(err, 'Error reaching cmon-agent');
                next(new lib_errors.InternalServerError());
            } else {
                res.header('content-type', 'text/plain');
                res.send(data2);
                next();
            }
        });
    } else if (cache.vms.has(target_uuid)) {
        var vmCacheItem = cache.vms.get(target_uuid);
        mod_assert.object(vmCacheItem, 'vm cache obj');

        var server_uuid = vmCacheItem.server_uuid;
        mod_assert.uuid(server_uuid, 'server_uuid');

        serverCacheItem = cache.admin_ips.get(server_uuid);
        mod_assert.object(serverCacheItem, 'admin ip cache obj');

        admin_ip = serverCacheItem.admin_ip;
        mod_assert.string(admin_ip, 'admin_ip');

        cmon_agent_url = 'http://' + admin_ip + ':9163';
        cmon_agent_path = '/v1/' + target_uuid + '/metrics';
        client = mod_restify.createStringClient({ url: cmon_agent_url });
        client.get(cmon_agent_path, function _vmFetch(err, req2, res2, data2) {
            if (err) {
                req.log.error(err, 'Error reaching cmon-agent');
                next(new lib_errors.InternalServerError());
            } else {
                res.header('content-type', 'text/plain');
                res.send(data2);
                next();
            }
        });
    } else {
        req.log.info({ cache: cache, uuid: target_uuid}, 'target not in cache');
        next(new lib_errors.NotFoundError());
    }
}

function mount(opts) {
    mod_assert.object(opts.server, 'opts.server');
    opts.server.get({ name: 'GetMetrics', path: '/metrics' }, apiGetMetrics);
}

module.exports = { mount: mount };
