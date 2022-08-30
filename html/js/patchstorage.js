// TODO: necessary?
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


JqueryClass('patchstorageBox', {
    init: function (options) {
        var self = $(this)

        options = $.extend({
            resultCanvas: self.find('.js-patchstorage'),
            removePluginBundles: function (bundles, callback) {
                callback({})
            },
            // TODO:
            // upgradePluginURI: function (uri, usingLabs, callback) {
            //     callback({}, "")
            // },
            info: null,
            fake: false,
            isMainWindow: true,
            windowName: "Patchstorage",
            pluginsData: {},
            localChecked: false,
            cloudChecked: false
        }, options)

        self.data(options)

        var searchbox = self.find('input[type=search]')

        // make sure searchbox is empty on init
        searchbox.val("")

        self.data('searchbox', searchbox)
        searchbox.cleanableInput()

        self.data('category', null)
        self.patchstorageBox('setCategory', "All")

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
        searchbox.on('paste', function (e) {
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

        self.find('#patchstorage_update_all').hide()
        // TODO:
        // $('#patchstorage_update_all').click(function (e) {
        //     if (!$(this).hasClass("disabled")) {
        //         $(this).addClass("disabled").css({ color: '#444' })
        //         self.patchstorageBox('installAllPlugins', true)
        //     }
        // })

        var results = {}
        self.data('results', results)

        self.find('ul.categories li').click(function () {
            var category = $(this).attr('id').replace(/^patchstorage-tab-/, '')
            self.patchstorageBox('setCategory', category)
        })

        options.open = function () {
            self.patchstorageBox('search')
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
                plugin.thumbnail_href = "/effect/image/thumbnail.png?uri=" + uri + "&v=" + ver
            } else {
                plugin.screenshot_href = "/resources/pedals/default-screenshot.png"
                plugin.thumbnail_href = "/resources/pedals/default-thumbnail.png"
            }
        }
        else {
            //if (!plugin.screenshot_available && !plugin.thumbnail_available) {
            if (!plugin.screenshot_href && !plugin.thumbnail_href) {
                plugin.screenshot_href = "/resources/pedals/default-screenshot.png"
                plugin.thumbnail_href = "/resources/pedals/default-thumbnail.png"
            }
        }
    },

    // patchstorage patch obj to plugin
    transformPatch: function (patch) {
        patch.psid = patch.id
        // TODO: final uri format?
        patch.uri = patch.id
        patch.latestVersion = (patch.revision) ? patch.revision.split('.') : [0, 0, 0, 0]
        patch.plugin_href = patch.link
        patch.author.homepage = patch.link
        // TODO: replace replace - find a better safe solution
        patch.name = patch.title.replace(/&amp;/g, '&')
        patch.label = patch.title.replace(/&amp;/g, '&')
        patch.comment = patch.excerpt.replace(/&amp;/g, '&')
        patch.brand = patch.author.name.replace(/&amp;/g, '&')
        patch.thumbnail_href = patch.artwork.url
        patch.screenshot_href = patch.artwork.url
        patch.category = patch.categories.map((cat) => {
            return cat.name
        })
        return patch
    },

    transformPatches: function (patches) {
        var self = $(this)
        patches.map((patch, i) => {
            patch = self.patchstorageBox('transformPatch', patch)
        })
        return patches
    },

    getCloudPlugins: function (query, store, callback) {
        var self = $(this)
        var base = PATCHSTORAGE_API_URL
        var platform = PATCHSTORAGE_PLATFORM_ID
        var url = `${base}?per_page=100&platforms=${platform}&orderby=download_count&order=asc`
        var page = 1

        function getNextPage() {
            $.ajax({
                url: url + `&page=${page}`,
                method: 'GET',
                async: true,
                cache: false,
                dataType: 'json',
                success: function (patches, textStatus, request) {
                    if (!patches || patches.length < 1) {
                        return
                    }

                    var pages = request.getResponseHeader('x-wp-totalpages')
                    var transformed = self.patchstorageBox('transformPatches', patches)
                    store.cloud = store.cloud.concat(transformed)

                    if (pages && pages > page) {
                        page++
                        getNextPage()
                    } else {
                        callback()
                    }
                },
                error: (error) => {
                    new Notification('error', "Connection to Patchstorage failed!", 5000)
                    callback()
                }
            });
        }

        getNextPage()
    },

    getLocalPlugins: function (query, store, callback) {
        // TODO: fix indexer vs api
        if (query.text) {
            var lplugins = {}

            var ret = desktop.pluginIndexer.search(query.text)
            for (var i in ret) {
                var uri = ret[i].ref
                var pluginData = self.data('pluginsData')[uri]
                if (!pluginData) {
                    console.log("ERROR: Plugin '" + uri + "' was not previously cached, cannot show it")
                    continue
                }
                lplugins[uri] = pluginData
            }

            store.local = $.extend(true, {}, lplugins) // deep copy instead of link/reference
            callback()
        }
        else {
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

                    store.local = $.extend(true, {}, allplugins) // deep copy instead of link/reference
                    callback()
                },
                error: function () {
                    store.local = {}
                    callback()
                },
                cache: false,
                dataType: 'json'
            })
        }
    },

    updatePluginLocalData: function (plugin, callback) {
        var self = $(this)

        if ((plugin.bundles && plugin.bundles.length > 0) || !plugin.installedVersion) {
            self.data('localChecked', true)
            callback()
            return
        }
    
        var renderedVersion = [plugin.builder,
            plugin.microVersion,
            plugin.minorVersion,
            plugin.release].join('_');
        
        $.ajax({
            url: "/effect/get",
            data: {
                uri: plugin.uri,
                version: VERSION,
                plugin_version: renderedVersion,
            },
            success: function (data) {
                plugin = $.extend(data, plugin)
                self.data('localChecked', true)
                callback(plugin)
            },
            error: function () {
                // assume not installed
                plugin.installedVersion = null
                plugin.installed_version = null
                self.data('localChecked', true)
                callback(plugin)
            },
            cache: !!plugin.buildEnvironment,
            dataType: 'json'
        })
    },
    
    updatePluginCloudData: function (plugin, callback) {
        var self = $(this)

        if (!plugin.psid) {
            self.data('cloudChecked', true)
            callback()
            return
        }

        $.ajax({
            url: `${PATCHSTORAGE_API_URL}/${plugin.psid}`,
            method: 'GET',
            async: true,
            cache: false,
            dataType: 'json',
            success: function (data) {
                plugin = $.extend(data, plugin)
                // TODO: what other fields we need to update?
                plugin.comment = data.content.replace(/&amp;/g, '&')
                self.data('cloudChecked', true)
                callback(plugin)
            },
            error: function () {
                self.data('cloudChecked', true)
                callback(plugin)
            }
        });
    },

    // search all or installed, depending on selected option
    search: function (customRenderCallback) {
        console.log('search')
        var self = $(this)
        var query = {
            text: self.data('searchbox').val(),
            summary: "true",
            image_version: VERSION,
            bin_compat: BIN_COMPAT,
        }

        if (self.find('input:checkbox[name=installed]:checked').length)
            return self.patchstorageBox('searchInstalled', query, customRenderCallback)

        if (self.find('input:checkbox[name=non-installed]:checked').length)
            return self.patchstorageBox('searchAll', false, query, customRenderCallback)

        return self.patchstorageBox('searchAll', true, query, customRenderCallback)
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
            plugin.thumbnail_href = plugin.thumbnail_href.replace("thumbnail", "screenshot")
        }
    },

    rebuildSearchIndex: function () {
        console.log('rebuildSearchIndex')
        var plugins = Object.values($(this).data('pluginsData'))
        desktop.resetPluginIndexer(plugins.filter(function (plugin) { return !!plugin.installedVersion }))
    },

    // search cloud and local plugins, prefer cloud
    searchAll: function (showInstalled, query, customRenderCallback) {
        console.log('searchAll')
        var self = $(this)
        var results = {
            local: [],
            cloud: []
        }
        var cplugin, lplugin = false

        renderResults = function () {
            if (results.local == null || results.cloud == null)
                return

            var plugins = []

            for (var i in results.cloud) {
                cplugin = results.cloud[i]
                lplugin = results.local[cplugin.uri]

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
                    cplugin.status = 'available'
                }

                if (!cplugin.screenshot_available && !cplugin.thumbnail_available) {
                    if (!cplugin.screenshot_href && !cplugin.thumbnail_href) {
                        cplugin.screenshot_href = "/resources/pedals/default-screenshot.png"
                        cplugin.thumbnail_href = "/resources/pedals/default-thumbnail.png"
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
                    self.patchstorageBox('synchronizePluginData', lplugin)
                    plugins.push(lplugin)
                }
            }

            if (customRenderCallback) {
                customRenderCallback(plugins)
            } else {
                self.patchstorageBox('showPlugins', plugins)
            }

            self.patchstorageBox('rebuildSearchIndex')
        }

        self.patchstorageBox('getCloudPlugins', query, results, renderResults)
        self.patchstorageBox('getLocalPlugins', query, results, renderResults)
    },

    // search cloud and local plugins, show installed only
    searchInstalled: function (query, customRenderCallback) {
        console.log('searchInstalled')
        var self = $(this)
        var results = {
            store: [],
            cloud: []
        }
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
                    lplugin.stable = cplugin.stable
                    lplugin.latestVersion = cplugin.latestVersion

                    if (compareVersions(lplugin.installedVersion, lplugin.latestVersion) >= 0) {
                        lplugin.status = 'installed'
                    } else {
                        lplugin.status = 'outdated'
                    }

                } else {
                    lplugin.latestVersion = null
                    lplugin.status = 'installed'
                }

                // we're showing installed only, so prefer to show installed modgui screenshot
                if (lplugin.gui) {
                    var uri = escape(lplugin.uri)
                    var ver = [lplugin.builder, lplugin.microVersion, lplugin.minorVersion, lplugin.release].join('_')

                    lplugin.screenshot_href = "/effect/image/screenshot.png?uri=" + uri + "&v=" + ver
                    lplugin.thumbnail_href = "/effect/image/thumbnail.png?uri=" + uri + "&v=" + ver
                } else {
                    lplugin.screenshot_href = "/resources/pedals/default-screenshot.png"
                    lplugin.thumbnail_href = "/resources/pedals/default-thumbnail.png"
                }
                self.patchstorageBox('synchronizePluginData', lplugin)
                plugins.push(lplugin)
            }

            if (customRenderCallback) {
                customRenderCallback(plugins)
            } else {
                self.patchstorageBox('showPlugins', plugins)
            }

            self.patchstorageBox('rebuildSearchIndex')
        }

        preparePlugins = function() {
            var plugins = results.cloud
            var cplugins = {}
            for (var i in plugins) {
                delete plugins[i].installedVersion
                delete plugins[i].bundles
                cplugins[plugins[i].uri] = plugins[i]
            }
            results.cloud = cplugins
            if (results.local != null)
                renderResults()
        }

        // TODO: fix callback
        self.patchstorageBox('getCloudPlugins', query, results, preparePlugins)
        self.patchstorageBox('getLocalPlugins', query, results, renderResults)
    },

    showPlugins: function (plugins) {
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

        var category = {}
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

        var getCategory = function (plugin) {
            category = plugin.category[0]
            if (category == 'Utility' && plugin.category.length == 2 && plugin.category[1] == 'MIDI') {
                return 'MIDI';
            }
            return category
        }

        var plugin, render
        var factory = function (img) {
            return function () {
                img.css('opacity', 1)
                var top = (parseInt((img.parent().height() - img.height()) / 2)) + 'px'
                // We need to put a padding in image, but slick creates clones of the
                // element to use on carousel, so we need padding in all clones
                var uri = img.parent().parent().parent().parent().attr('mod-uri')
                var clones = $('div.slick-slide[mod-uri="' + uri + '"][mod-role="cloud-plugin"]')
                clones.find('img').css('padding-top', top);
            };
        }

        for (var i in plugins) {
            plugin = plugins[i]
            category = getCategory(plugin)
            render = self.patchstorageBox('renderPlugin', plugin)

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

    // OK
    renderPlugin: function (plugin) {
        var self = $(this)
        var data = self.patchstorageBox('getPluginInfoData', plugin, false)
        var template = TEMPLATES.cloudplugin
        var rendered = $(Mustache.render(template, data))
        rendered.click(function () {
            self.patchstorageBox('showPluginInfo', plugin.uri)
        })

        return rendered
    },

    // OK
    installPlugin: function (plugin, callback) {
        // long lived notification
        var notification = new Notification('warning')
        var installationMsg = 'Downloading: ' + plugin.files[0].filename
        
        notification.open()
        notification.html(installationMsg)
        notification.type('warning')
        notification.bar(1)

        var trans = new SimpleTransference(plugin.files[0].url, '/effect/install',
        { to_args: { headers:
            { 'Patchstorage-Item' : plugin.psid }
        }})

        trans.reauthorizeDownload = desktop.authenticateDevice;

        trans.reportPercentageStatus = function (percentage) {
            notification.bar(percentage*100)

            if (percentage == 1) {
                installationMsg = installationMsg.replace("Downloading", "Installing")
                notification.html(installationMsg)
            }
        }

        trans.reportError = function (reason) {
            console.log(reason)
            queue = []
            callbacks = []
            notification.close()
            new Notification('error', "Could not install plugin: " + reason, 5000)

            desktop.updateAllPlugins()
        }

        trans.reportFinished = function (resp) {
            var result = resp.result

            if (result.ok) {
                notification.html(installationMsg.replace("Installing:", "Done! Installed:"))
                notification.bar(0)
                notification.type('success')
                notification.closeAfter(3000)
            } else {
                // close previous notification
                notification.closeAfter(1000)
                new Notification('error', "Could not install plugin: " + result.error, 5000)
            }

            desktop.updateAllPlugins()

            var bundlename = (result.bundles && result.bundles.length > 0) ? result.bundles[0] : null

            callback(result, bundlename)
        }

        trans.start()
    },

    // TODO: needs some work
    postInstallAction: function (installed, removed, bundlename) {
        var self = $(this)
        var bundle = LV2_PLUGIN_DIR + bundlename
        var category, categories = self.data('categoryCount')
        var uri, plugin, oldElem, newElem

        for (var i in installed) {
            uri = installed[i]
            plugin = self.data('pluginsData')[uri]

            if (!plugin) {
                continue
            }

            plugin.status = 'installed'
            plugin.bundles = [bundle]
            plugin.installedVersion = plugin.latestVersion

            oldElem = self.find('.cloud-plugin[mod-uri="' + escape(uri) + '"]')
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
                $('#effect-content-Favorites').find('[mod-uri="' + escape(uri) + '"]').remove()
                $('#effect-tab-Favorites').html('Favorites (' + FAVORITES.length + ')')
            }

            plugin = self.data('pluginsData')[uri]
            oldElem = self.find('.cloud-plugin[mod-uri="' + escape(uri) + '"]')

            if (plugin.latestVersion) {
                // removing a plugin available on cloud, keep its store item
                plugin.status = 'blocked'
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

    // OK
    getPluginInfoData: function (plugin, full = false) {
        var basic = {
            uri: plugin.uri,
            escaped_uri: escape(plugin.uri),
            comment: plugin.comment.trim() || "No description available",
            has_comment: (plugin.comment) ? null : "no_description",
            author: plugin.author,
            screenshot_href: plugin.screenshot_href,
            thumbnail_href: plugin.thumbnail_href,
            status: plugin.status,
            brand: plugin.brand,
            label: plugin.label
        }

        if (full === false) {
            console.log(basic)
            return basic
        }
        
        if (plugin.ports) {
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
        }
        
        // TODO: solve categories question
        var category = plugin.category[0]
        if (category == 'Utility' && plugin.category.length == 2 && plugin.category[1] == 'MIDI') {
            category = 'MIDI'
        }

        var package_name = (plugin.bundle_name) ? plugin.bundle_name.replace(/\.lv2$/, '') : null
        if (!package_name && plugin.bundles && plugin.bundles[0]) {
            package_name = plugin.bundles[0].replace(/\.lv2$/, '')
        }

        var extensive = {
            name: plugin.name,
            ports: plugin.ports,
            category: category || "None",
            installed_version: version(plugin.installedVersion),
            latest_version: version(plugin.latestVersion),
            package_name: package_name,
            plugin_href: plugin.plugin_href,
            pedalboard_href: desktop.getPedalboardHref(plugin.uri),
            build_env: plugin.buildEnvironment,
            build_env_uppercase: plugin.buildEnvironment ? plugin.buildEnvironment.toUpperCase(): "LOCAL",
            // TODO: is needed?
            show_build_env: false // plugin.buildEnvironment !== "prod"
        }

        return $.extend(basic, extensive)
    },

    // OK
    showPluginInfo: function (uri) {
        var self = $(this)
        var plugin = self.data('pluginsData')[uri]
        
        self.data('cloudChecked', false)
        self.data('localChecked', false)

        var showInfo = function (plugin) {

            if (!self.data('localChecked') || !self.data('cloudChecked'))
                return
            
            // cleanup
            self.data('info', null)

            var metadata = self.patchstorageBox('getPluginInfoData', plugin, true)
            var info = self.data('info')
            
            info = $(Mustache.render(TEMPLATES.cloudplugin_info, metadata))

            // The remove button will remove the plugin, close window and re-render the plugins
            // without the removed one
            if (plugin.installedVersion) {
                info.find('.js-install').hide()
                info.find('.js-remove').show().click(function () {
                    // Remove plugin
                    self.data('removePluginBundles')(plugin.bundles, function (resp) {
                        var bundlename = plugin.bundles[0].split('/').filter(function (el) { return el.length != 0 }).pop(0)
                        self.patchstorageBox('postInstallAction', [], resp.removed, bundlename)
                        info.window('close')

                        // remove-only action, need to manually update plugins
                        desktop.updatePluginList([], resp.removed)
                        // HACK: need a better solution for reloading state
                        self.patchstorageBox('search')
                    })
                })
            } else {
                info.find('.js-remove').hide()
                info.find('.js-install').show().click(function () {
                    self.patchstorageBox('installPlugin', plugin, function (resp, bundlename) {
                        self.patchstorageBox('postInstallAction', resp.installed, resp.removed, bundlename)
                        info.window('close')
                        // HACK: need a better solution for reloading state
                        self.patchstorageBox('search')
                    })
                })
            }

            if (plugin.installedVersion && plugin.latestVersion && compareVersions(plugin.latestVersion, plugin.installedVersion) > 0) {
                info.find('.js-upgrade').show().click(function () {
                    // Upgrade plugin
                    self.data('upgradePluginURI')(plugin.uri, false, function (resp, bundlename) {
                        self.patchstorageBox('postInstallAction', resp.installed, resp.removed, bundlename)
                        info.window('close')
                    })
                })
            } else {
                info.find('.js-upgrade').hide()
            }

            info.appendTo($('body'))
            info.window({
                windowName: "Patchstorage Plugin Info"
            })

            info.window('open')
            self.data('info', info)
        }

        self.patchstorageBox('updatePluginLocalData', plugin, showInfo)
        self.patchstorageBox('updatePluginCloudData', plugin, showInfo)
    }
})
