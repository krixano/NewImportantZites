version = "0.1";
ziteLanguages = [
	"CS", "DA", "DE", "EN", "ES", "EO", "FR", "HU", "IT", "KO", "NL", "PL", "PT", "PT-BR", "RU", "TR", "UK", "ZH", "ZH-TW"
];

var defaultLang = require("./default-lang.js");
console.log(defaultLang);

var anime = require("animejs");
window.anime = anime;
var Materialize = require("materialize-css/dist/js/materialize.min.js");

/*var MarkdownIt = require("markdown-it");
md = new MarkdownIt({
	html: false,
	linkify: true
});*/

var ZeroFrame = require("./libs/ZeroFrame.js");
var Router = require("./libs/router.js");
var searchDbQuery = require("./libs/search.js");

var Vue = require("vue/dist/vue.min.js");

var VueZeroFrameRouter = require("./libs/vue-zeroframe-router.js");

//var { sanitizeStringForUrl, sanitizeStringForUrl_SQL, html_substr, sanitizeHtmlForDb } = require("./util.js");

Vue.use(VueZeroFrameRouter.VueZeroFrameRouter);

// Vue Components
var Navbar = require("./vue_components/navbar.vue");

var app = new Vue({
	el: "#app",
	template: `<div>
			<component ref="navbar" :is="navbar" :user-info="userInfo" :lang-translation="langTranslation"></component>
			<component ref="view" :is="currentView" v-on:get-user-info="getUserInfo()" :user-info="userInfo" :zite-to-import="ziteToImport" v-on:import-zite="importZite" :lang-translation="langTranslation"></component>
		</div>`,
	data: {
		navbar: Navbar,
		currentView: null,
		siteInfo: null,
		userInfo: null,
		ziteToImport: null,
		langTranslation: defaultLang
	},
	methods: {
		getUserInfo: function(f = null) {
			console.log(this.siteInfo);
            if (this.siteInfo == null || this.siteInfo.cert_user_id == null) {
                this.userInfo = null;
				this.$emit("setuserinfo", this.userInfo);
				this.$emit("update");
                return;
            }

            var that = this;

            if (f !== null && typeof f === "function") f();

            page.cmd("dbQuery", ["SELECT key, value FROM keyvalue LEFT JOIN json USING (json_id) WHERE cert_user_id=\"" + this.siteInfo.cert_user_id + "\" AND directory=\"users/" + this.siteInfo.auth_address + "\""], (rows) => {
                var keyvalue = {};

                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    
                    keyvalue[row.key] = row.value;
                }
				
				that.userInfo = {
					privatekey: that.siteInfo.privatekey,
					cert_user_id: that.siteInfo.cert_user_id,
					auth_address: that.siteInfo.auth_address,
					keyvalue: keyvalue
				};

				if (that.userInfo.keyvalue.ko_interface) {
					page.cmdp("fileGet", { "inner_path": "languages/ko.json", "required": false }).then((data) => {
						data = JSON.parse(data);
						console.log("langdata: ", data);
						if (data) {
							app.langTranslation = data;
							app.$emit("setLanguage", data);
						}
					});
				} else if (that.userInfo.keyvalue.cs_interface) {
					page.cmdp("fileGet", { "inner_path": "languages/cs.json", "required": false }).then((data) => {
						data = JSON.parse(data);
						console.log("langdata: ", data);
						if (data) {
							app.langTranslation = data;
							app.$emit("setLanguage", data);
						}
					});
				}

				console.log("Keyvalue: ", that.userInfo.keyvalue);

				that.$emit("setUserInfo", that.userInfo); // TODO: Not sure if I need this if I can pass in a function callback instead
				that.$emit("update", that.userInfo);
				if (f !== null && typeof f === "function") f();
            });
		},
		importZite: function(zite) {
			this.ziteToImport = zite;
			Router.navigate('import-zite');
		}
	}
});

class ZeroApp extends ZeroFrame {
	onOpenWebsocket() {
		var self = this;

		this.cmdp("serverInfo", {})
			.then((serverInfo) => {
				console.log(serverInfo);
				self.serverInfo = serverInfo;
				app.serverInfo = serverInfo;
				return this.cmdp("fileGet", { "inner_path": "languages/" + self.serverInfo.language + ".json", "required": false })
			}).then((data) => {
				data = JSON.parse(data);
				console.log("langdata: ", data);
				if (data) {
					app.langTranslation = data;
					app.$emit("setLanguage", data);
				}
				return this.cmdp("siteInfo", {});
			}).then((siteInfo) => {
				console.log(siteInfo);
				self.siteInfo = siteInfo;
				app.siteInfo = siteInfo;
				if (siteInfo.address!="1MiS3ud9JogSQpd1QVmM6ETHRmk5RgJn6E" && !siteInfo.settings.own){self.cmdp("wrapperNotification", ["warning", "Note: This is a clone. This greatly reduces the<br>\n visibility of your zite if you only add it here. You<br>\ncan find the original zite at this address:<br>\n 1MiS3ud9JogSQpd1QVmM6ETHRmk5RgJn6E."]);}
				app.getUserInfo();
			});
	}

	onRequest(cmd, message) {
		Router.listenForBack(cmd, message);
		if (cmd === "setSiteInfo") {
			this.siteInfo = message.params;
			app.siteInfo = message.params;
			app.getUserInfo();
		}

		if (message.params.event[0] === "file_done") {
			app.$emit("update");
		}
	}

	selectUser() {
		return this.cmdp("certSelect", { accepted_domains: ["zeroid.bit", "kxoid.bit", "kaffie.bit", "cryptoid.bit", "peak.id"] });
    }

    signout() {
    	return this.cmdp("certSelect", { accepted_domains: [""] });
    }

    unimplemented() {
        return page.cmdp("wrapperNotification", ["info", "Unimplemented!"]);
	}

	setSettings(languages, ko_interface, cs_interface, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to set language settings."]);
    	}

    	var data_inner_path = "data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				data = {};
				}
				
				data["languages"] = languages.replace(/\s/g, "");
				data["ko_interface"] = ko_interface;
				data["cs_interface"] = cs_interface;

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
										app.getUserInfo();
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});

	}
	
	getMergerCategoryNames() {
		var query = `
			SELECT DISTINCT merger_category FROM zites
			`;
		return page.cmdp("dbQuery", [query]);
	}

	getCategories() {
		var query = `
			SELECT * FROM categories
			`;
		return page.cmdp("dbQuery", [query]);
	}

	getBookmarkCategories() {
		if (!app.userInfo || !app.userInfo.auth_address) return;
		
		
		var query = `
			SELECT * FROM bookmark_categories
			INNER JOIN json USING (json_id)
			WHERE directory='users/${app.userInfo.auth_address}'
			`;
		//console.log(query);
		return page.cmdp("dbQuery", [query]);
	}

	getZite(auth_address, id) {
		var query = `
			SELECT *
				${app.userInfo && app.userInfo.auth_address ? ", (" + this.subQueryBookmarks() + ")" : ""}
			FROM zites
			INNER JOIN json USING (json_id)
			WHERE id=${id} AND json.directory='users/${auth_address}'
			LIMIT 1
			`;
		return page.cmdp("dbQuery", [query]);
	}

	getZiteByAddress(address) {
		var query = `
			SELECT *
			FROM zites
			INNER JOIN json USING (json_id)
			WHERE address='${address}'
			LIMIT 1
			`;
		return page.cmdp("dbQuery", [query]);
	}

	getZites(pageNum = 0, limit = 8) {
		const offset = pageNum * limit;
		var query = `
			SELECT *
				${app.userInfo && app.userInfo.auth_address ? ", " + this.subQueryBookmarks() : ""}
			FROM zites
			INNER JOIN json USING (json_id)
			LIMIT ${limit}
			OFFSET ${offset}
			`;
		return page.cmdp("dbQuery", [query]);
	}

	getZitesInCategory(categorySlug, pageNum = 0, limit = 8) {
		const offset = pageNum * limit;
		var query = `
			SELECT *
				${app.userInfo && app.userInfo.auth_address ? ", " + this.subQueryBookmarks() : ""}
			FROM zites
			INNER JOIN json USING (json_id)
			WHERE category_slug="${categorySlug}"
			LIMIT ${limit}
			OFFSET ${offset}
			`;
		return page.cmdp("dbQuery", [query]);
	}

	getBookmarkZites(pageNum = 0, limit = 8) {
		const offset = pageNum * limit;
		var query = `
			SELECT *
				${app.userInfo && app.userInfo.auth_address ? ", (" + this.subQueryBookmarks() + ") AS bookmarkCount" : ""}
			FROM zites
			INNER JOIN json USING (json_id)
				${app.userInfo && app.userInfo.auth_address ? "WHERE bookmarkCount >= 1" : ""}
			${limit ? "LIMIT " + limit : ""}
			${limit ? "OFFSET " + offset : ""}
			`;
		console.log(query);
		return page.cmdp("dbQuery", [query]);
	}

	subQueryBookmarks(bookmarkCategoryId) {
		if (!app.userInfo || !app.userInfo.auth_address) {
			return "";
		}
		var categoryWhere = "";
		if (bookmarkCategoryId && bookmarkCategoryId != "All" && bookmarkCategoryId != "MyZites") {
			categoryWhere = " AND bookmarks.category_id=" + bookmarkCategoryId;
		}
		var s = `
			SELECT DISTINCT COUNT(*) FROM bookmarks INNER JOIN json AS bookmarksjson USING (json_id) WHERE zites.id=bookmarks.reference_id AND bookmarksjson.directory='users/${app.userInfo.auth_address}' ${categoryWhere}
			`;
		return s;
	}
	
	getAdminZitesSearch(searchQuery, pageNum = 0, limit = 8) {
		var languageWhere = "";
		var query = searchDbQuery(this, searchQuery, {
			orderByScore: true,
			id_col: "id",
			select: "*",
			searchSelects: [
				{ col: "title", score: 5 },
				{ col: "domain", score: 5 },
				{ col: "address", score: 5 },
				{ col: "tags", score: 4 },
				{ col: "category_slug", score: 4 },
				{ col: "merger_category", score: 4 },
				{ col: "creator", score: 3 },
				{ col: "description", score: 2 },
				{ skip: !app.userInfo || !app.userInfo.auth_address, col: "bookmarkCount", select: this.subQueryBookmarks(), inSearchMatchesAdded: false, inSearchMatchesOrderBy: true, score: 6 } // TODO: Rename inSearchMatchesAdded, and isSearchMatchesOrderBy
			],
			table: "zites",
			join: "INNER JOIN json USING (json_id)",
			where: languageWhere,
			page: pageNum,
			afterOrderBy: "date_added ASC",
			limit: limit
		});
		return this.cmdp("dbQuery", [query]);
	}

	// TODO: Username/id at multiplication of 1
	getZitesSearch(searchQuery, pageNum = 0, limit = 8) {
		var searchSelects = [
			{ col: "title", score: 5 },
			{ col: "domain", score: 5 },
			{ col: "address", score: 5 },
			{ col: "tags", score: 4 },
			{ col: "category_slug", score: 4 },
			{ col: "merger_category", score: 4 },
			{ col: "creator", score: 3 },
			{ col: "description", score: 2 },
			{ skip: !app.userInfo || !app.userInfo.auth_address, col: "bookmarkCount", select: this.subQueryBookmarks(), inSearchMatchesAdded: false, inSearchMatchesOrderBy: true, score: 6 } // TODO: Rename inSearchMatchesAdded, and isSearchMatchesOrderBy
		];

		var languageWhere = "";
		if (app.userInfo && app.userInfo.keyvalue && app.userInfo.keyvalue.languages && app.userInfo.keyvalue.language != "") {
			languageWhere += "(";
			var languages = app.userInfo.keyvalue.languages.split(",");
			for (var i = 0; i < languages.length; i++) {
				var language = languages[i];
				if (i != 0) languageWhere += " OR ";
				languageWhere += "languages LIKE '" + language + "' OR languages LIKE '%," + language + "' OR languages LIKE '" + language + ",%' OR languages LIKE '%," + language + ",%'";
			}
			languageWhere += " OR languages='' OR languages IS NULL";
			languageWhere += ")";
		} else if (app.serverInfo && app.serverInfo.language) {
			// When not logged in, push up, in the results, the zites that are in the same language as the client but still display the zites that aren't in the same language (they'd just be lower in list)
			searchSelects.push({
				col: "langCount",
				select: `SELECT DISTINCT COUNT(*) FROM zites AS langzites INNER JOIN json AS langjson USING (json_id) WHERE zites.id=langzites.id AND (langzites.languages LIKE '${app.serverInfo.language.toUpperCase()}' OR langzites.languages LIKE '${app.serverInfo.language.toUpperCase()},%' OR langzites.languages LIKE '%,${app.serverInfo.language.toUpperCase()}' OR langzites.languages LIKE '%,${app.serverInfo.language.toUpperCase()},%')`,
				isSearchMatchesAdded: false,
				isSearchMatchesOrderBy: true,
				score: 1
			});
			searchSelects.push({
				col: "langCount2",
				select: `SELECT DISTINCT COUNT(*) FROM zites AS langzites INNER JOIN json AS langjson USING (json_id) WHERE zites.id=langzites.id AND (langzites.languages LIKE '${app.serverInfo.language.toUpperCase()}')`,
				isSearchMatchesAdded: false,
				isSearchMatchesOrderBy: true,
				score: 1
			})
		}
		var query = searchDbQuery(this, searchQuery, {
			orderByScore: true,
			id_col: "id",
			select: "*",
			searchSelects: searchSelects,
			table: "zites",
			join: "INNER JOIN json USING (json_id)",
			where: languageWhere,
			page: pageNum,
			afterOrderBy: "date_added ASC",
			limit: limit
		});
		return this.cmdp("dbQuery", [query]);
	}

	getZitesInCategorySearch(categorySlug, searchQuery, pageNum = 0, limit = 8) {
		var languageWhere = "";
		if (app.userInfo && app.userInfo.keyvalue && app.userInfo.keyvalue.languages && app.userInfo.keyvalue.language != "") {
			languageWhere += " AND (";
			var languages = app.userInfo.keyvalue.languages.split(",");
			for (var i = 0; i < languages.length; i++) {
				var language = languages[i];
				if (i != 0) languageWhere += " OR ";
				languageWhere += "languages LIKE '" + language + "' OR languages LIKE '%," + language + "' OR languages LIKE '" + language + ",%' OR languages LIKE '%," + language + ",%'";
			}
			languageWhere += " OR languages='' OR languages IS NULL";
			languageWhere += ")";
		}
		var query = searchDbQuery(this, searchQuery, {
			orderByScore: true,
			id_col: "id",
			select: "*",
			searchSelects: [
				{ col: "title", score: 5 },
				{ col: "domain", score: 5 },
				{ col: "address", score: 5 },
				{ col: "tags", score: 4 },
				{ col: "category_slug", score: 4 },
				{ col: "merger_category", score: 4 },
				{ col: "creator", score: 3 },
				{ col: "description", score: 2 },
				{ skip: !app.userInfo || !app.userInfo.auth_address, col: "bookmarkCount", select: this.subQueryBookmarks(), inSearchMatchesAdded: false, inSearchMatchesOrderBy: true, score: 6 } // TODO: Rename inSearchMatchesAdded, and isSearchMatchesOrderBy
			],
			table: "zites",
			where: "category_slug='" + categorySlug + "'" + languageWhere,
			join: "INNER JOIN json USING (json_id)",
			afterOrderBy: "date_added ASC",
			page: pageNum,
			limit: limit
		});
		return this.cmdp("dbQuery", [query]);
	}


	getMyZitesSearch(searchQuery, pageNum = 0, limit = 8) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to see your zites."]);
		}

		var query = searchDbQuery(this, searchQuery, {
			orderByScore: true,
			id_col: "id",
			select: "*",
			searchSelects: [
				{ col: "title", score: 5 },
				{ col: "domain", score: 5 },
				{ col: "address", score: 5 },
				{ col: "tags", score: 4 },
				{ col: "category_slug", score: 4 },
				{ col: "merger_category", score: 4 },
				{ col: "creator", score: 3 },
				{ col: "description", score: 2 },
				{ skip: !app.userInfo || !app.userInfo.auth_address, col: "bookmarkCount", select: this.subQueryBookmarks(), inSearchMatchesAdded: false, inSearchMatchesOrderBy: true, score: 6 } // TODO: Rename inSearchMatchesAdded, and isSearchMatchesOrderBy
			],
			table: "zites",
			where: "directory='users/" + app.userInfo.auth_address + "'",
			join: "INNER JOIN json USING (json_id)",
			afterOrderBy: "date_added ASC",
			page: pageNum,
			limit: limit
		});
		return this.cmdp("dbQuery", [query]);
	}

	// bookmarkCategoryId -
	//  "All" for All bookmarks
	//  "MyZites" for My Zites that are bookmarked
	//  or Id of bookmark category
	getBookmarkZitesSearch(bookmarkCategoryId, searchQuery, pageNum = 0, limit = 8) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to see your bookmarks."]);
		}

		var myZitesCategoryWhere = "";
		if (app.userInfo && app.userInfo.auth_address && bookmarkCategoryId === "MyZites") {
			myZitesCategoryWhere = " AND directory='users/" + app.userInfo.auth_address + "'";
		}
		
		var query = searchDbQuery(this, searchQuery, {
			orderByScore: true,
			id_col: "id",
			select: "*",
			searchSelects: [
				{ col: "title", score: 5 },
				{ col: "domain", score: 5 },
				{ col: "address", score: 5 },
				{ col: "tags", score: 4 },
				{ col: "category_slug", score: 4 },
				{ col: "merger_category", score: 4 },
				{ col: "creator", score: 3 },
				{ col: "description", score: 2 },
				{ skip: !app.userInfo || !app.userInfo.auth_address, col: "bookmarkCount", select: this.subQueryBookmarks(bookmarkCategoryId), inSearchMatchesAdded: false, inSearchMatchesOrderBy: false, score: 6 } // TODO: Rename inSearchMatchesAdded, and isSearchMatchesOrderBy
			],
			table: "zites",
			where: (app.userInfo && app.userInfo.auth_address ? "bookmarkCount >= 1" : "") + myZitesCategoryWhere,
			join: "INNER JOIN json USING (json_id)",
			afterOrderBy: "date_added ASC",
			page: pageNum,
			limit: limit
		});
		return this.cmdp("dbQuery", [query]);
	}

	// merger_supported :: bool
	addZite(title, address, domain, creator, description, tags, category_slug, merger_supported, merger_category, languages, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to add a zite."]);
    	}

    	var data_inner_path = "data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				data = {};
    			}

    			if (!data["zites"]) data["zites"] = [];

				var date = Date.now();
				
				var slug = title.toLowerCase().replace(/\s*/g, "_").replace(/(\.|\:)/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

				address = address.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\/$/g, "");
				domain = domain.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\/$/g, "");
				title = title.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\.bit/g, "").replace(/(#.*|\?.*)/g, "").replace(/\/$/g, "");
				merger_category = merger_category.replace(/(merged|merger)-/g, "");
				creator = creator.replace(/(.)@.*$/g, "$1");

				languages = languages.replace(/\s/g, "");

    			data["zites"].push({
    				"id": date,
					"title": title.trim(),
					"address": address.trim(),
					"domain": domain.trim(),
					"creator": creator,
					"slug": slug.trim(),
					"description": description.trim(),
					"category_slug": category_slug,
					"tags": tags.trim(),
					"merger_supported": merger_supported,
					"merger_category": merger_category.trim(),
					"languages": languages,
    				"date_added": date
    			});

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": date, "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": date, "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": date, "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}

	editZite(id, title, address, domain, creator, description, tags, category_slug, merger_supported, merger_category, languages, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to add a zite."]);
    	}

    	var data_inner_path = "data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
					console.log("Error!");
					return;
    			}

    			if (!data["zites"]) {
					console.log("Error!");
					return;
				}

				var date = Date.now();
				
				var slug = title.toLowerCase().replace(/\s*/g, "_").replace(/(\.|\:)/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

				address = address.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\/$/g, "");
				domain = domain.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\/$/g, "");
				title = title.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\.bit/g, "").replace(/(#.*|\?.*)/g, "").replace(/\/$/g, "");
				merger_category = merger_category.replace(/(merged|merger)-/g, "");
				creator = creator.replace(/(.)@.*$/g, "$1");

				languages = languages.replace(/\s/g, "");

				for (var i in data["zites"]) {
					var zite = data["zites"][i];
					if (zite.id == id) {
						data["zites"][i].title = title.trim();
						data["zites"][i].address = address.trim();
						data["zites"][i].domain = domain.trim();
						data["zites"][i].creator = creator.trim();
						data["zites"][i].slug = slug.trim();
						data["zites"][i].description = description.trim();
						data["zites"][i].category_slug = category_slug;
						data["zites"][i].tags = tags.trim();
						data["zites"][i].merger_supported = merger_supported;
						data["zites"][i].merger_category = merger_category.trim();
						data["zites"][i].languages = languages.trim();
						data["zites"][i].date_updated = date;
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": id, "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": id, "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": id, "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}

	deleteZite(id, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to add a zite."]);
    	}

    	var data_inner_path = "data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
					console.log("Error!");
					return;
    			}

    			if (!data["zites"]) {
					console.log("Error!");
					return;
				}

				var date = Date.now();
				
				for (var i in data["zites"]) {
					var zite = data["zites"][i];
					if (zite.id == id) {
						data["zites"].splice(i, 1);
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": id, "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": id, "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": id, "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}

	editZiteAdmin(auth_address, id, title, address, domain, creator, description, tags, category_slug, merger_supported, merger_category, languages, beforePublishCB) {
		if (!this.siteInfo.privatekey) {
    		return this.cmdp("wrapperNotification", ["error", "You must be an admin to edit this zite."]);
    	}

    	var data_inner_path = "data/users/" + auth_address + "/data.json";
    	var content_inner_path = "data/users/" + auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
					console.log("Error!");
					return;
    			}

    			if (!data["zites"]) {
					console.log("Error!");
					return;
				}

				var date = Date.now();
				
				var slug = title.toLowerCase().replace(/\s*/g, "_").replace(/(\.|\:)/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

				address = address.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\/$/g, "");
				domain = domain.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\/$/g, "");
				title = title.replace(/((https?|zero|zeronet)\:\/\/|(127\.0\.0\.1|192\.168\.0\.[0-9]+)(\:[0-9]+)?\/?|localhost|.*(\.(com|net|org|tk|uk|eu|co))+(\:[0-9]+)?\/?|zero\/)/g, "").replace(/(\?|#)\/?$/, "").replace(/\.bit/g, "").replace(/(#.*|\?.*)/g, "").replace(/\/$/g, "");
				merger_category = merger_category.replace(/(merged|merger)-/g, "");
				creator = creator.replace(/(.)@.*$/g, "$1");
				languages = languages.replace(/\s/g, "");

				for (var i in data["zites"]) {
					var zite = data["zites"][i];
					if (zite.id == id) {
						data["zites"][i].title = title.trim();
						data["zites"][i].address = address.trim();
						data["zites"][i].domain = domain.trim();
						data["zites"][i].creator = creator.trim();
						data["zites"][i].slug = slug.trim();
						data["zites"][i].description = description.trim();
						data["zites"][i].category_slug = category_slug;
						data["zites"][i].tags = tags.trim();
						data["zites"][i].merger_supported = merger_supported;
						data["zites"][i].merger_category = merger_category.trim();
						data["zites"][i].languages = languages.trim();
						data["zites"][i].date_updated = date;
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", ["stored", content_inner_path])
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": id, "auth_address": auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": id, "auth_address": auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": id, "auth_address": auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}

	deleteZiteAdmin(auth_address, id, beforePublishCB) {
		if (!this.siteInfo.privatekey) {
    		return this.cmdp("wrapperNotification", ["error", "You must be an admin to edit this zite."]);
    	}

    	var data_inner_path = "data/users/" + auth_address + "/data.json";
    	var content_inner_path = "data/users/" + auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
					console.log("Error!");
					return;
    			}

    			if (!data["zites"]) {
					console.log("Error!");
					return;
				}

				for (var i in data["zites"]) {
					var zite = data["zites"][i];
					if (zite.id == id) {
						data["zites"].splice(i, 1);
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", ["stored", content_inner_path])
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": id, "auth_address": auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": id, "auth_address": auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": id, "auth_address": auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}

	addBookmark(reference_id, reference_auth_address, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to add a zite."]);
    	}

    	var data_inner_path = "data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
					data = {};
    			}

    			if (!data["bookmarks"]) {
					data["bookmarks"] = [];
				}

				var date = Date.now();

				data["bookmarks"].push({
					"id": date,
					"reference_id": reference_id,
					"reference_auth_address": reference_auth_address,
					"date_added": date
				});
				
    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": date, "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": date, "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": date, "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}

	removeBookmark(reference_id, reference_auth_address, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to add a zite."]);
    	}

    	var data_inner_path = "data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
					return; // TODO: Error!
    			}

    			if (!data["bookmarks"]) {
					return; // TODO: Error!
				}

				var date = Date.now();
				var keepLooping = true;
				while (keepLooping) {
					for (let i = 0; i < data["bookmarks"].length; i++) { // Go thorough whole list in case of duplicates
						var bookmark = data["bookmarks"][i];
						if (bookmark.reference_id == reference_id && bookmark.reference_auth_address == reference_auth_address) {
							if (i == data["bookmarks"].length - 1) {
								keepLooping = false;
							}
							data["bookmarks"].splice(i, 1);
							break;
						} else {
							if (i == data["bookmarks"].length - 1) {
								keepLooping = false;
							}
						}
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": date, "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": date, "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": date, "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}

	addBookmarkCategory(name, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to add a zite."]);
    	}

    	var data_inner_path = "data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				data = {};
    			}

    			if (!data["bookmark_categories"]) data["bookmark_categories"] = [];

				var date = Date.now();
				
    			data["bookmark_categories"].push({
    				"id": date,
					"name": name.trim(),
    				"date_added": date
    			});

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": date, "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": date, "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": date, "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}

	setBookmarkCategory(reference_id, reference_auth_address, categoryId, beforePublishCB) {
		if (!this.siteInfo.cert_user_id) {
    		return this.cmdp("wrapperNotification", ["error", "You must be logged in to add a zite."]);
    	}

    	var data_inner_path = "data/users/" + this.siteInfo.auth_address + "/data.json";
    	var content_inner_path = "data/users/" + this.siteInfo.auth_address + "/content.json";

    	var self = this;
    	return this.cmdp("fileGet", { "inner_path": data_inner_path, "required": false })
    		.then((data) => {
    			data = JSON.parse(data);
    			if (!data) {
    				data = {};
    			}

				var date = null;

    			if (!data["bookmarks"]) return;

				for (var i = 0; i < data["bookmarks"].length; i++) {
					if (data["bookmarks"][i].reference_id == reference_id && data["bookmarks"][i].reference_auth_address == reference_auth_address) {
						data["bookmarks"][i]["category_id"] = categoryId;
						date = data["bookmarks"][i].date_added;
						break;
					}
				}

    			var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

    			return self.cmdp("fileWrite", [data_inner_path, btoa(json_raw)])
					.then((res) => {
		    			if (res === "ok") {
		    				return self.cmdp("siteSign", { "inner_path": content_inner_path })
		    					.then((res) => {
		    						if (res === "ok") {
		    							if (beforePublishCB != null && typeof beforePublishCB === "function") beforePublishCB({ "id": date, "auth_address": self.siteInfo.auth_address });
		    							return self.cmdp("sitePublish", { "inner_path": content_inner_path, "sign": false })
		    								.then(() => {
		    									return { "id": date, "auth_address": self.siteInfo.auth_address };
		    								}).catch((err) => {
                                                console.log(err);
                                                return { "id": date, "auth_address": self.siteInfo.auth_address, "err": err };
                                            });
		    						} else {
		    							return self.cmdp("wrapperNotification", ["error", "Failed to sign user data."]);
		    						}
		    					});
		    			} else {
		    				return self.cmdp("wrapperNotification", ["error", "Failed to write to data file."]);
		    			}
		    		});
	    	});
	}
}

page = new ZeroApp();

var Home = require("./router_pages/home.vue");
var About = require("./router_pages/about.vue");
var AddZite = require("./router_pages/add-zite.vue");
var EditZite = require("./router_pages/edit-zite.vue");
var ImportZite = require("./router_pages/import-zite.vue");
var MyZites = require("./router_pages/my-zites.vue");
var MyBookmarks = require("./router_pages/my-bookmarks.vue");
var CategoryPage = require("./router_pages/categoryPage.vue");

var TotalSearch = require("./router_pages/totalSearch.vue");

var ZiteZeroUp = require("./router_pages/zite-zeroup.vue");
var ZiteZeroSites = require("./router_pages/zite-zerosites.vue");
var ZiteZeroList = require("./router_pages/zite-0list.vue");
var ZiteZeroTalk = require("./router_pages/zite-zerotalk.vue");
var ZiteKiwipedia = require("./router_pages/zite-kiwipedia.vue");
var ZiteZeroMe = require("./router_pages/zite-zerome.vue");
var Settings = require("./router_pages/settings.vue");
var Admin = require("./router_pages/admin.vue");
var EditZiteAdmin = require("./router_pages/edit-zite-admin.vue");

VueZeroFrameRouter.VueZeroFrameRouter_Init(Router, app, [
	{ route: "admin/edit/:authaddress/:ziteid", component: EditZiteAdmin },
	{ route: "admin", component: Admin },
	{ route: "about", component: About },
	{ route: "settings", component: Settings },
	{ route: "zite/zeroup", component: ZiteZeroUp },
	{ route: "zite/zerosites", component: ZiteZeroSites },
	{ route: "zite/zerolist", component: ZiteZeroList },
	{ route: "zite/zerotalk", component: ZiteZeroTalk },
	{ route: "zite/kiwipedia", component: ZiteKiwipedia },
	{ route: "zite/zerome", component: ZiteZeroMe },
	{ route: "total-search", component: TotalSearch },
	{ route: "my-bookmarks", component: MyBookmarks },
	{ route: "my-zites", component: MyZites },
	{ route: "import-zite", component: ImportZite },
	{ route: "edit-zite/:ziteid", component: EditZite },
	{ route: "add-zite", component: AddZite },
	{ route: "category/:categoryslug", component: CategoryPage },
	{ route: "", component: Home }
]);
