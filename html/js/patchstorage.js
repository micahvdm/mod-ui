/*
 * Copyright 2012-2013 AGR Audio, Industria e Comercio LTDA. <contato@moddevices.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// add this to plugin data when cloud fails
function getDummyPluginData() {
    return $.extend(true, {}, {
        ports: {
            control: {
                input: []
            },
        },
    })
}

class Patchstorage {
    static transformPatch(p) {
        p.patchstorage_id = p.id
        p.uri = `https://patchstorage.com/?page_id=${p.id}`
        p.author.homepage = p.link
        p.name = p.title.replace(/&amp;/g, '&')
        p.label = p.title.replace(/&amp;/g, '&')
        p.comment = p.excerpt.replace(/&amp;/g, '&')
        p.brand = p.author.name.replace(/&amp;/g, '&')
        p.thumbnail_href = p.artwork.url
        p.screenshot_href = p.artwork.url
        p.category = p.categories.map((cat) => {
            return cat.name
        })
        return p
    }

    static transformPatches(patches) {
        patches.map((p, i) => {
            p = this.transformPatch(p)
        })
        return patches
    }
}

JqueryClass('patchstorageBox', {
    init: function (options) {
        var self = $(this)

        options = $.extend({
            resultCanvas: self.find('.js-patchstorage'),
            removePluginBundles: function (bundles, callback) {
                callback({})
            },
            installPluginURI: function (uri, usingLabs, callback) {
                callback({}, "")
            },
            upgradePluginURI: function (uri, usingLabs, callback) {
                callback({}, "")
            },
            info: null,
            fake: false,
            isMainWindow: true,
            usingLabs: false,
            windowName: "Plugin Store",
            pluginsData: {},
        }, options)

        self.data(options)

        var searchbox = self.find('input[type=search]')

        // make sure searchbox is empty on init
        searchbox.val("")

        self.data('searchbox', searchbox)
        searchbox.cleanableInput()

        self.data('category', null)
        self.patchstorageBox('setCategory', "All")

        self.data('usingLabs', self.find('input:radio[name=plugins-source]:checked').val() === 'labs')

        var lastKeyTimeout = null
        searchbox.keydown(function (e) {
            if (e.keyCode == 13) { // detect enter
                if (lastKeyTimeout != null) {
                    clearTimeout(lastKeyTimeout)
                    lastKeyTimeout = null
                }
                self.patchstorageBox('search')
                return false
            }
            else if (e.keyCode == 8 || e.keyCode == 46) { // detect delete and backspace
                if (lastKeyTimeout != null) {
                    clearTimeout(lastKeyTimeout)
                }
                lastKeyTimeout = setTimeout(function () {
                    self.patchstorageBox('search')
                }, 400);
            }
        })
        searchbox.keypress(function (e) { // keypress won't detect delete and backspace but will only allow inputable keys
            if (e.which == 13)
                return
            if (lastKeyTimeout != null) {
                clearTimeout(lastKeyTimeout)
            }
            lastKeyTimeout = setTimeout(function () {
                self.patchstorageBox('search')
            }, 400);
        })
        searchbox.on('paste', function(e) {
            if (lastKeyTimeout != null) {
                clearTimeout(lastKeyTimeout)
            }
            lastKeyTimeout = setTimeout(function () {
                self.patchstorageBox('search')
            }, 400);
        })

        self.find('input:checkbox[name=installed]').click(function (e) {
            self.find('input:checkbox[name=non-installed]').prop('checked', false)
            self.patchstorageBox('search')
        })
        self.find('input:checkbox[name=non-installed]').click(function (e) {
            self.find('input:checkbox[name=installed]').prop('checked', false)
            self.patchstorageBox('search')
        })
        self.find('input:checkbox[name=unstable]').click(function (e) {
            self.patchstorageBox('search')
        })

        self.find('input:radio[name=plugins-source]').click(function (e) {
            self.data('usingLabs', self.find('input:radio[name=plugins-source]:checked').val() === 'labs')
            self.patchstorageBox('search')
        })

        $('#patchstorage_install_all').click(function (e) {
            if (! $(this).hasClass("disabled")) {
                $(this).addClass("disabled").css({color:'#444'})
                self.patchstorageBox('installAllPlugins', false)
            }
        })
        $('#patchstorage_update_all').click(function (e) {
            if (! $(this).hasClass("disabled")) {
                $(this).addClass("disabled").css({color:'#444'})
                self.patchstorageBox('installAllPlugins', true)
            }
        })

        var results = {}
        self.data('results', results)

        self.data('firstLoad', true)
        self.find('ul.categories li').click(function () {
            var category = $(this).attr('id').replace(/^patchstorage-tab-/, '')
            self.patchstorageBox('setCategory', category)
        })

        options.open = function () {
            self.data('firstLoad', true)
            $('#patchstorage_install_all').addClass("disabled").css({color:'#444'})
            $('#patchstorage_update_all').addClass("disabled").css({color:'#444'})

            var unstablecb = self.find('input:checkbox[name=unstable]')
            if (!unstablecb.is(':checked')) {
                self.patchstorageBox('search')
            } else {
                unstablecb.click()
            }

            return false
        }

        self.window(options)

        return self
    },

    setCategory: function (category) {
        var self = $(this)

        self.find('ul.categories li').removeClass('selected')
        self.find('.plugins-wrapper').hide()
        self.find('#patchstorage-tab-' + category).addClass('selected')
        self.find('#patch-content-' + category).show().css('display', 'inline-block')
        self.data('category', category)

    },
    cleanResults: function () {
        var self = $(this)
        self.find('.plugins-wrapper').html('')
        self.find('ul.categories li').each(function () {
            var content = $(this).html().split(/\s/)
            if (content.length >= 2 && content[1] == "Utility") {
                $(this).html(content[0] + " Utility")
            } else {
                $(this).html(content[0])
            }
        });
    },
    checkLocalScreenshot: function (plugin) {
        if (plugin.status == 'installed') {
            if (plugin.gui) {
                var uri = escape(plugin.uri)
                var ver = plugin.installedVersion.join('_')
                plugin.screenshot_href = "/effect/image/screenshot.png?uri=" + uri + "&v=" + ver
                plugin.thumbnail_href  = "/effect/image/thumbnail.png?uri=" + uri + "&v=" + ver
            } else {
                plugin.screenshot_href = "/resources/pedals/default-screenshot.png"
                plugin.thumbnail_href  = "/resources/pedals/default-thumbnail.png"
            }
        }
        else {
            //if (!plugin.screenshot_available && !plugin.thumbnail_available) {
            if (!plugin.screenshot_href && !plugin.thumbnail_href) {
                plugin.screenshot_href = "/resources/pedals/default-screenshot.png"
                plugin.thumbnail_href  = "/resources/pedals/default-thumbnail.png"
            }
        }
    },

    // search all or installed, depending on selected option
    search: function (customRenderCallback) {
        console.log('search')
        var self  = $(this)
        var query = {
            text: self.data('searchbox').val(),
            summary: "true",
            image_version: VERSION,
            bin_compat: BIN_COMPAT,
        }

        if (self.find('input:checkbox[name=unstable]:checked').length == 0 || self.data('fake')) {
            query.stable = true
        }

        // hide/show featured plugins if searching/not searching
        var usingLabs = self.data('usingLabs')

        if (self.find('input:checkbox[name=installed]:checked').length)
            return self.patchstorageBox('searchInstalled', usingLabs, query, customRenderCallback)

        if (self.find('input:checkbox[name=non-installed]:checked').length)
            return self.patchstorageBox('searchAll', usingLabs, false, query, customRenderCallback)

        return self.patchstorageBox('searchAll', usingLabs, true, query, customRenderCallback)
    },

    synchronizePluginData: function (plugin) {
        console.log('synchronizePluginData')
        var index = $(this).data('pluginsData')
        indexed = index[plugin.uri]
        if (indexed == null) {
            indexed = {}
            index[plugin.uri] = indexed
        }
        // Let's store all data safely, while modifying the given object
        // to have all available data
        $.extend(indexed, plugin)
        $.extend(plugin, indexed)

        if (window.devicePixelRatio && window.devicePixelRatio >= 2) {
            plugin.thumbnail_href = plugin.thumbnail_href.replace("thumbnail","screenshot")
        }
    },

    rebuildSearchIndex: function () {
        console.log('rebuildSearchIndex')
        var plugins = Object.values($(this).data('pluginsData'))
        desktop.resetPluginIndexer(plugins.filter(function(plugin) { return !!plugin.installedVersion }))
    },

    getAllPatches: (query) => {
        console.log('getAllPatches')
        var self = $(this)
        var allPatches = []
        var page = 1
        var totalPages = 0
        var endpoint = PATCHSTORAGE_API_URL + "?per_page=100&platforms=662&orderby=download_count"
        var cont = true
        
        // TODO: async: false blocks browser execution
        while (cont) {
            $.ajax({
                method: 'GET',
                url: endpoint + `&page=${page}`,
                data: query,
                success: (patches, textStatus, request) => {
                    allPatches = allPatches.concat(patches)
                    totalPages = request.getResponseHeader('x-wp-totalpages')
                    if (!totalPages || totalPages == page) {
                        cont = false
                    }
                    page ++
                },
                error: (error) => {
                    console.log(error)
                    cont = false
                },
                cache: false,
                dataType: 'json',
                async: false
            })
        }

        allPatches = Patchstorage.transformPatches(allPatches)

        return allPatches
    },

    // search cloud and local plugins, prefer cloud
    searchAll: function (usingLabs, showInstalled, query, customRenderCallback) {
        console.log('searchAll')
        var self = $(this)
        var results = {}
        var cplugin, lplugin = false

        renderResults = function () {
            if (results.local == null || results.cloud == null)
                return

            var plugins = []

            for (var i in results.cloud) {
                cplugin = results.cloud[i]
                lplugin = results.local[cplugin.uri]

                cplugin.latestVersion = [cplugin.builder_version || 0, cplugin.minorVersion, cplugin.microVersion, cplugin.release_number]

                if (lplugin) {
                    if (!lplugin.installedVersion) {
                        console.log("local plugin is missing version info:", lplugin.uri)
                        lplugin.installedVersion = [0, 0, 0, 0]
                    }

                    cplugin.installedVersion = lplugin.installedVersion
                    delete results.local[cplugin.uri]

                    if (compareVersions(cplugin.installedVersion, cplugin.latestVersion) >= 0) {
                        cplugin.status = 'installed'
                    } else {
                        cplugin.status = 'outdated'
                    }

                    // overwrite build environment if local plugin
                    cplugin.buildEnvironment = lplugin.buildEnvironment

                    self.patchstorageBox('checkLocalScreenshot', cplugin)

                } else {
                    cplugin.installedVersion = null // if set to [0, 0, 0, 0], it appears as intalled on cloudplugininfo
                    cplugin.status = 'blocked'
                }

                if (!cplugin.screenshot_available && !cplugin.thumbnail_available) {
                    if (!cplugin.screenshot_href && !cplugin.thumbnail_href) {
                        cplugin.screenshot_href = "/resources/pedals/default-screenshot.png"
                        cplugin.thumbnail_href  = "/resources/pedals/default-thumbnail.png"
                    }
                }
                self.patchstorageBox('synchronizePluginData', cplugin)
                plugins.push(cplugin)
            }

            // for all the other plugins that are not in the cloud
            if (showInstalled) {
                for (var uri in results.local) {
                    lplugin = results.local[uri]
                    lplugin.status = 'installed'
                    lplugin.latestVersion = null
                    self.patchstorageBox('checkLocalScreenshot', lplugin)
                    if (lplugin.licensed) {
                        if (lplugin.licensed > 0) {
                            lplugin.licensed = true;
                        } else {
                            lplugin.licensed = false;
                            lplugin.demo = true;
                        }
                    }
                    self.patchstorageBox('synchronizePluginData', lplugin)
                    plugins.push(lplugin)
                }
            }

            if (customRenderCallback) {
                customRenderCallback(plugins)
            } else {
                self.patchstorageBox('showPlugins', plugins)
            }

            if (self.data('firstLoad')) {
                self.data('firstLoad', false)
                $('#patchstorage_install_all').removeClass("disabled").css({color:'white'})
                $('#patchstorage_update_all').removeClass("disabled").css({color:'white'})
            }
            self.patchstorageBox('rebuildSearchIndex')
        }

        // cloud search
        results.cloud = self.patchstorageBox('getAllPatches', query)

        renderResults()

        // local search
        if (query.text)
        {
            var lplugins = {}

            var ret = desktop.pluginIndexer.search(query.text)
            for (var i in ret) {
                var uri = ret[i].ref
                var pluginData = self.data('pluginsData')[uri]
                if (! pluginData) {
                    console.log("ERROR: Plugin '" + uri + "' was not previously cached, cannot show it")
                    continue
                }
                lplugins[uri] = pluginData
            }

            results.local = $.extend(true, {}, lplugins) // deep copy instead of link/reference
            renderResults()
        }
        else
        {
            console.log("patchstorage.ajax.effect_list.410")
            $.ajax({
                method: 'GET',
                url: '/effect/list',
                success: function (plugins) {
                    var i, plugin, allplugins = {}
                    for (i in plugins) {
                        plugin = plugins[i]

                        plugin.installedVersion = [plugin.builder, plugin.minorVersion, plugin.microVersion, plugin.release]
                        allplugins[plugin.uri] = plugin
                    }

                    results.local = $.extend(true, {}, allplugins) // deep copy instead of link/reference
                    renderResults()
                },
                error: function () {
                    results.local = {}
                    renderResults()
                },
                cache: false,
                dataType: 'json'
            })
        }
    },

    // search cloud and local plugins, show installed only
    searchInstalled: function (usingLabs, query, customRenderCallback) {
        console.log('searchInstalled')
        var self = $(this)
        var results = {}
        var cplugin, lplugin = false

        renderResults = function () {
            var plugins = []

            for (var i in results.local) {
                lplugin = results.local[i]
                cplugin = results.cloud[lplugin.uri]

                if (!lplugin.installedVersion) {
                    console.log("local plugin is missing version info:", lplugin.uri)
                    lplugin.installedVersion = [0, 0, 0, 0]
                }

                if (cplugin) {
                    lplugin.stable        = cplugin.stable
                    lplugin.latestVersion = [cplugin.builder_version || 0, cplugin.minorVersion, cplugin.microVersion, cplugin.release_number]

                    if (compareVersions(lplugin.installedVersion, lplugin.latestVersion) >= 0) {
                        lplugin.status = 'installed'
                    } else {
                        lplugin.status = 'outdated'
                    }
                    if (cplugin.shopify_id && !lplugin.licensed) {
                        lplugin.demo = true
                    }
                } else {
                    lplugin.latestVersion = null
                    lplugin.status = 'installed'
                }

                if (lplugin.licensed) {
                    if (lplugin.licensed > 0) {
                        lplugin.licensed = true;
                    } else {
                        lplugin.licensed = false;
                        lplugin.demo = true;
                    }
                }

                // we're showing installed only, so prefer to show installed modgui screenshot
                if (lplugin.gui) {
                    var uri = escape(lplugin.uri)
                    var ver = [lplugin.builder, lplugin.microVersion, lplugin.minorVersion, lplugin.release].join('_')

                    lplugin.screenshot_href = "/effect/image/screenshot.png?uri=" + uri + "&v=" + ver
                    lplugin.thumbnail_href  = "/effect/image/thumbnail.png?uri=" + uri + "&v=" + ver
                } else {
                    lplugin.screenshot_href = "/resources/pedals/default-screenshot.png"
                    lplugin.thumbnail_href  = "/resources/pedals/default-thumbnail.png"
                }
                self.patchstorageBox('synchronizePluginData', lplugin)
                plugins.push(lplugin)
            }

            if (customRenderCallback) {
                customRenderCallback(plugins)
            } else {
                self.patchstorageBox('showPlugins', plugins)
            }

            if (self.data('firstLoad')) {
                self.data('firstLoad', false)
                $('#patchstorage_install_all').removeClass("disabled").css({color:'white'})
                $('#patchstorage_update_all').removeClass("disabled").css({color:'white'})
            }
            self.patchstorageBox('rebuildSearchIndex')
        }

        // cloud search
        console.log("patchstorage.ajax.lv2_plugins.511")
        $.ajax({
            method: 'GET',
            url: (usingLabs ? CLOUD_LABS_URL : SITEURL) + "/lv2/plugins",
            data: query,
            success: function (plugins) {
                // index by uri, needed later to check its latest version
                var cplugins = {}
                for (var i in plugins) {
                    delete plugins[i].installedVersion
                    delete plugins[i].bundles
                    cplugins[plugins[i].uri] = plugins[i]
                }
                results.cloud = cplugins
                if (results.local != null)
                    renderResults()
            },
            error: function () {
                results.cloud = {}
                if (results.local != null)
                    renderResults()
            },
            cache: false,
            dataType: 'json'
        })

        // local search
        if (query.text)
        {
            var lplugins = []

            var ret = desktop.pluginIndexer.search(query.text)
            for (var i in ret) {
                var uri = ret[i].ref
                var pluginData = self.data('pluginsData')[uri]
                if (! pluginData) {
                    console.log("ERROR: Plugin '" + uri + "' was not previously cached, cannot show it")
                    continue
                }
                lplugins.push(pluginData)
            }

            results.local = $.extend(true, {}, lplugins) // deep copy instead of link/reference
            if (results.cloud != null)
                renderResults()
        }
        else
        {
            console.log("patchstorage.ajax.effect_list.559")
            $.ajax({
                method: 'GET',
                url: '/effect/list',
                success: function (plugins) {
                    var i, plugin
                    for (i in plugins) {
                        plugin = plugins[i]
                        plugin.installedVersion = [plugin.builder || 0, plugin.minorVersion, plugin.microVersion, plugin.release]
                    }

                    results.local = plugins
                    if (results.cloud != null)
                        renderResults()
                },
                cache: false,
                dataType: 'json'
            })
        }
    },

    showPlugins: function (plugins) {
        console.log('showPlugins')
        var self = $(this)
        self.patchstorageBox('cleanResults')

        // sort plugins by label
        plugins.sort(function (a, b) {
            a = a.label.toLowerCase()
            b = b.label.toLowerCase()
            if (a > b) {
                return 1
            }
            if (a < b) {
                return -1
            }
            return 0
        })

        var category   = {}
        var categories = {
            'All': plugins.length,
            'ControlVoltage': 0,
            'Delay': 0,
            'Distortion': 0,
            'Dynamics': 0,
            'Filter': 0,
            'Generator': 0,
            'MIDI': 0,
            'Modulator': 0,
            'Reverb': 0,
            'Simulator': 0,
            'Spatial': 0,
            'Spectral': 0,
            'Utility': 0,
        }
        var cachedContentCanvas = {
            'All': self.find('#patch-content-All')
        }
        var pluginsDict = {}

        var getCategory = function(plugin) {
            category = plugin.category[0]
            if (category == 'Utility' && plugin.category.length == 2 && plugin.category[1] == 'MIDI') {
                return 'MIDI';
            }
            return category
        }

        var plugin, render
		var factory = function(img) {
			return function() {
			    img.css('opacity', 1)
                            var top = (parseInt((img.parent().height()-img.height())/2))+'px'
                            // We need to put a padding in image, but slick creates clones of the
                            // element to use on carousel, so we need padding in all clones
                            var uri = img.parent().parent().parent().parent().attr('mod-uri')
                            var clones = $('div.slick-slide[mod-uri="'+uri+'"][mod-role="cloud-plugin"]')
                            clones.find('img').css('padding-top', top);
			};
		}

        for (var i in plugins) {
            plugin   = plugins[i]
            category = getCategory(plugin)
            render   = self.patchstorageBox('renderPlugin', plugin)

            pluginsDict[plugin.uri] = plugin

            if (category && category != 'All' && categories[category] != null) {
                categories[category] += 1
                if (cachedContentCanvas[category] == null) {
                    cachedContentCanvas[category] = self.find('#patch-content-' + category)
                }
                render.clone(true).appendTo(cachedContentCanvas[category])
            }

            render.appendTo(cachedContentCanvas['All'])
        }

        self.data('pluginsDict', pluginsDict)

        // display plugin count
        self.patchstorageBox('setCategoryCount', categories)
    },

    setCategoryCount: function (categories) {
        var self = $(this)
        self.data('categoryCount', categories)

        for (var category in categories) {
            var tab = self.find('#patchstorage-tab-' + category)
            if (tab.length == 0) {
                continue
            }
            var content = tab.html().split(/\s/)

            if (content.length >= 2 && content[1] == "Utility") {
                content = content[0] + " Utility"
            } else {
                content = content[0]
            }
            tab.html(content + ' <span class="plugin_count">(' + categories[category] + ')</span>')
        }
    },

    renderPlugin: function (plugin) {
        console.log('renderPlugin')
        var self = $(this)
        var comment = plugin.comment.trim()
        var has_comment = ""
        if(!comment) {
            comment = "No description available";
            has_comment = "no_description";
        }
        var plugin_data = {
            uri: escape(plugin.uri),
            screenshot_href: plugin.screenshot_href,
            thumbnail_href: plugin.thumbnail_href,
            has_comment: has_comment,
            comment: comment,
            status: plugin.status,
            brand : plugin.brand,
            label : plugin.label,
            demo: !!plugin.demo,
            price: plugin.price,
            licensed: plugin.licensed,
            coming: plugin.coming,
            unstable: plugin.stable === false,
            build_env: plugin.buildEnvironment,
        }

        var template = TEMPLATES.cloudplugin
        var rendered = $(Mustache.render(template, plugin_data))
        rendered.click(function () {
            self.patchstorageBox('showPluginInfo', plugin.uri)
        })

        return rendered
    },

    installAllPlugins: function (updateOnly) {
        console.log('installAllPlugins')
        var self = $(this)

        self.patchstorageBox('search', function (plugins) {
            // sort plugins by label
            var alower, blower
            plugins.sort(function (a, b) {
                alower = a.label.toLowerCase()
                blower = b.label.toLowerCase()
                if (alower > blower)
                    return 1
                if (alower < blower)
                    return -1
                return 0
            })

            var bundle_id, bundle_ids = []
            var currentCategory = $("#patchstorage-library .categories .selected").attr('id').replace(/^patchstorage-tab-/, '') || "All"

            var plugin
            for (var i in plugins) {
                plugin = plugins[i]
                if (! plugin.bundle_id || ! plugin.latestVersion) {
                    continue
                }
                if (plugin.installedVersion) {
                    if (compareVersions(plugin.latestVersion, plugin.installedVersion) <= 0) {
                        continue
                    }
                } else if (updateOnly) {
                    continue
                }

                var category = plugin.category[0]
                if (category == 'Utility' && plugin.category.length == 2 && plugin.category[1] == 'MIDI') {
                    category = 'MIDI'
                }

                // FIXME for midi
                if (bundle_ids.indexOf(plugin.bundle_id) < 0 && (currentCategory == "All" || currentCategory == category)) {
                    bundle_ids.push(plugin.bundle_id)
                }
            }

            if (bundle_ids.length == 0) {
                $('#patchstorage_install_all').removeClass("disabled").css({color:'white'})
                $('#patchstorage_update_all').removeClass("disabled").css({color:'white'})
                new Notification('warn', 'All plugins are '+(updateOnly?'updated':'installed')+', nothing to do', 8000)
                return
            }

            var count = 0
            var finished = function (resp, bundlename) {
                self.patchstorageBox('postInstallAction', resp.installed, resp.removed, bundlename)
                count += 1
                if (count == bundle_ids.length) {
                    $('#patchstorage_install_all').removeClass("disabled").css({color:'white'})
                    $('#patchstorage_update_all').removeClass("disabled").css({color:'white'})
                    new Notification('warn', 'All plugins are now '+(updateOnly?'updated':'installed'), 8000)
                }
                if (resp.ok) {
                    self.patchstorageBox('search')
                }
            }
            var usingLabs = self.data('usingLabs')

            for (var i in bundle_ids) {
                desktop.installationQueue.installUsingBundle(bundle_ids[i], usingLabs, finished)
            }
        })
    },

    postInstallAction: function (installed, removed, bundlename) {
        console.log('postInstallAction')
        var self = $(this)
        var bundle = LV2_PLUGIN_DIR + bundlename
        var category, categories = self.data('categoryCount')
        var uri, plugin, oldElem, newElem

        for (var i in installed) {
            uri    = installed[i]
            plugin = self.data('pluginsData')[uri]

            if (! plugin) {
                continue
            }

            plugin.status  = 'installed'
            if (plugin.commercial && !plugin.licensed)
                plugin.demo = true;
            plugin.bundles = [bundle]
            plugin.installedVersion = plugin.latestVersion

            oldElem = self.find('.cloud-plugin[mod-uri="'+escape(uri)+'"]')
            newElem = self.patchstorageBox('renderPlugin', plugin)
            oldElem.replaceWith(newElem)
        }

        for (var i in removed) {
            uri = removed[i]

            if (installed.indexOf(uri) >= 0) {
                continue
            }

            var favoriteIndex = FAVORITES.indexOf(uri)
            if (favoriteIndex >= 0) {
                FAVORITES.splice(favoriteIndex, 1)
                $('#effect-content-Favorites').find('[mod-uri="'+escape(uri)+'"]').remove()
                $('#effect-tab-Favorites').html('Favorites (' + FAVORITES.length + ')')
            }

            plugin  = self.data('pluginsData')[uri]
            oldElem = self.find('.cloud-plugin[mod-uri="'+escape(uri)+'"]')

            if (plugin.latestVersion) {
                // removing a plugin available on cloud, keep its store item
                plugin.status = 'blocked'
                plugin.demo = false
                plugin.bundle_name = bundle
                delete plugin.bundles
                plugin.installedVersion = null

                newElem = self.patchstorageBox('renderPlugin', plugin)
                oldElem.replaceWith(newElem)

            } else {
                // removing local plugin means the number of possible plugins goes down
                category = plugin.category[0]

                if (category && category != 'All') {
                    if (category == 'Utility' && plugin.category.length == 2 && plugin.category[1] == 'MIDI') {
                        category = 'MIDI'
                    }
                    categories[category] -= 1
                }
                categories['All'] -= 1

                // remove it from store
                delete self.data('pluginsData')[uri]
                oldElem.remove()
            }
        }

        self.patchstorageBox('setCategoryCount', categories)
    },

    showPluginInfo: function (uri) {
        console.log('showPluginInfo')
        var self = $(this)
        var plugin = self.data('pluginsData')[uri]
        var cloudChecked = false
        var localChecked = false

        var showInfo = function() {
            if (!cloudChecked || !localChecked)
                return

            // formating numbers and flooring ranges up to two decimal cases
            for (var i = 0; i < plugin.ports.control.input.length; i++) {
                plugin.ports.control.input[i].formatted = format(plugin.ports.control.input[i])
            }

            if (plugin.ports.cv && plugin.ports.cv.input) {
              for (var i = 0; i < plugin.ports.cv.input.length; i++) {
                plugin.ports.cv.input[i].formatted = format(plugin.ports.cv.input[i])
              }
            }

            if (plugin.ports.cv && plugin.ports.cv.output) {
              for (var i = 0; i < plugin.ports.cv.output.length; i++) {
                plugin.ports.cv.output[i].formatted = format(plugin.ports.cv.output[i])
              }
            }

            var category = plugin.category[0]
            if (category == 'Utility' && plugin.category.length == 2 && plugin.category[1] == 'MIDI') {
                category = 'MIDI'
            }

            // Plugin might have been licensed after plugin data was bound to event,
            // so let's check
            if (desktop.licenseManager && desktop.licenseManager.licensed(plugin.uri)) {
                plugin.licensed = true;
                plugin.demo = false;
                plugin.coming = false;
                plugin.price = null;
            }

            var package_name = (plugin.bundle_name) ? plugin.bundle_name.replace(/\.lv2$/, '') : null
            if (!package_name && plugin.bundles && plugin.bundles[0]) {
                package_name = plugin.bundles[0].replace(/\.lv2$/, '')
            }

            var metadata = {
                author: plugin.author,
                uri: plugin.uri,
                escaped_uri: escape(plugin.uri),
                thumbnail_href: plugin.thumbnail_href,
                screenshot_href: plugin.screenshot_href,
                category: category || "None",
                installed_version: version(plugin.installedVersion),
                latest_version: version(plugin.latestVersion),
                package_name: package_name,
                comment: plugin.comment.trim() || "No description available",
                brand : plugin.brand,
                name  : plugin.name,
                label : plugin.label,
                ports : plugin.ports,
                plugin_href: PLUGINS_URL + '/' + btoa(plugin.uri),
                pedalboard_href: desktop.getPedalboardHref(plugin.uri),
                shopify_id: plugin.shopify_id,
                price: plugin.price,
                trial: plugin.commercial && !plugin.licensed && plugin.status != 'blocked',
                demo: !!plugin.demo,
                licensed: plugin.licensed,
                coming: plugin.coming,
                build_env_uppercase: plugin.buildEnvironment ? plugin.buildEnvironment.toUpperCase()
                                                             : (plugin.stable === false ? "BETA" : "LOCAL"),
                // TODO: is needed?
                show_build_env: false // plugin.buildEnvironment !== "prod",
            };

            var info = self.data('info')

            if (info) {
                info.remove()
                self.data('info', null)
            }
            info = $(Mustache.render(TEMPLATES.cloudplugin_info, metadata))

            // hide control ports table if none available
            if (plugin.ports.control.input.length == 0) {
                info.find('.plugin-controlports').hide()
            }

            // hide cv inputs table if none available
            if (!plugin.ports.cv || (plugin.ports.cv && plugin.ports.cv.input && plugin.ports.cv.input.length == 0)) {
                info.find('.plugin-cvinputs').hide()
            }

            // hide cv ouputs ports table if none available
            if (!plugin.ports.cv || (plugin.ports.cv && plugin.ports.cv.output && plugin.ports.cv.output.length == 0)) {
                info.find('.plugin-cvoutputs').hide()
            }

            var canInstall = false

            // The remove button will remove the plugin, close window and re-render the plugins
            // without the removed one
            if (plugin.installedVersion) {
                info.find('.js-install').hide()
                info.find('.js-remove').show().click(function () {
                    // Remove plugin
                    self.data('removePluginBundles')(plugin.bundles, function (resp) {
                        var bundlename = plugin.bundles[0].split('/').filter(function(el){return el.length!=0}).pop(0)
                        self.patchstorageBox('postInstallAction', [], resp.removed, bundlename)
                        info.window('close')

                        // remove-only action, need to manually update plugins
                        desktop.updatePluginList([], resp.removed)
                    })
                })
            } else {
                canInstall = true
                info.find('.js-remove').hide()
                info.find('.js-installed-version').hide()
                info.find('.js-install').show().click(function () {
                    // Install plugin
                    self.data('installPluginURI')(plugin.uri, self.data('usingLabs'), function (resp, bundlename) {
                        self.patchstorageBox('postInstallAction', resp.installed, resp.removed, bundlename)
                        info.window('close')
                    })
                })
            }

            if (plugin.installedVersion && plugin.latestVersion && compareVersions(plugin.latestVersion, plugin.installedVersion) > 0) {
                canUpgrade = true
                info.find('.js-upgrade').show().click(function () {
                    // Upgrade plugin
                    self.data('upgradePluginURI')(plugin.uri, self.data('usingLabs'), function (resp, bundlename) {
                        self.patchstorageBox('postInstallAction', resp.installed, resp.removed, bundlename)
                        info.window('close')
                    })
                })
            } else {
                info.find('.js-upgrade').hide()
            }

            if (! plugin.latestVersion) {
                info.find('.js-latest-version').hide()
            }

            info.appendTo($('body'))
            info.window({
                windowName: "Patchstorage Plugin Info"
            })

            if (metadata.shopify_id && !metadata.licensed) {
                desktop.createBuyButton(metadata.shopify_id)
            }

            info.window('open')
            self.data('info', info)
        }

        // get full plugin info if plugin has a local version
        if ((plugin.bundles && plugin.bundles.length > 0) || ! plugin.installedVersion) {
            localChecked = true
        } else {
            var renderedVersion = [plugin.builder,
                                   plugin.microVersion,
                                   plugin.minorVersion,
                                   plugin.release].join('_');
            console.log("patchstorage.ajax.local_effect_get.1028")
            $.ajax({
                url: "/effect/get",
                data: {
                    uri: plugin.uri,
                    version: VERSION,
                    plugin_version: renderedVersion,
                },
                success: function (pluginData) {
                    // delete cloud specific fields just in case
                    delete pluginData.bundle_name
                    delete pluginData.latestVersion
                    // ready to merge
                    plugin = $.extend(pluginData, plugin)
                    localChecked = true
                    showInfo()
                },
                error: function () {
                    // assume not installed
                    plugin.installedVersion = null
                    plugin.installed_version = null
                    localChecked = true
                    showInfo()
                },
                cache: !!plugin.buildEnvironment,
                dataType: 'json'
            })
        }

        // always get cloud plugin info
        console.log("patchstorage.ajax.single_plugin_info.1058")
        $.ajax({
            url: (self.data('usingLabs') ? CLOUD_LABS_URL : SITEURL) + "/lv2/plugins",
            data: {
                uri: plugin.uri,
                image_version: VERSION,
                bin_compat: BIN_COMPAT,
            },
            success: function (pluginData) {
                if (pluginData && pluginData.length > 0) {
                    pluginData = pluginData[0]
                    // delete local specific fields just in case
                    delete pluginData.bundles
                    delete pluginData.installedVersion
                    // ready to merge
                    plugin = $.extend(pluginData, plugin)
                    plugin.latestVersion = [plugin.builder_version || 0, plugin.minorVersion, plugin.microVersion, plugin.release_number]
                } else {
                    plugin = $.extend(getDummyPluginData(), plugin)
                    plugin.latestVersion = null
                }
                cloudChecked = true
                showInfo()
            },
            error: function () {
                plugin = $.extend(getDummyPluginData(), plugin)
                plugin.latestVersion = null
                cloudChecked = true
                showInfo()
            },
            cache: false,
            dataType: 'json'
        })
    },
})
