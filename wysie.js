/*
 * Stretchy: Form element autosizing, the way it should be.
 * by Lea Verou http://lea.verou.me 
 * MIT license
 */
(function() {

if (!self.Element) {
	return; // super old browser
}

if (!Element.prototype.matches) {
	Element.prototype.matches = Element.prototype.webkitMatchesSelector || Element.prototype.mozMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.oMatchesSelector || null;
}

if (!Element.prototype.matches) {
	return;
}

function $$(expr, con) {
	return expr instanceof Node || expr instanceof Window? [expr] :
	       [].slice.call(typeof expr == "string"? (con || document).querySelectorAll(expr) : expr || []);
}

var _ = self.Stretchy = {
	selectors: {
		base: 'textarea, select:not([size]), input:not([type]), input[type="' + "text url email tel".split(" ").join('"], input[type="') + '"]',
		filter: "*"
	},

	// Script element this was included with, if any
	script: $$("script").pop(),

	// Autosize one element. The core of Stretchy.
	resize: function(element) {
		if (!_.resizes(element)) {
			return;
		}
		
		var cs = getComputedStyle(element);
		var offset = 0;

		if (!element.value && element.placeholder) {
			var empty = true;
			element.value = element.placeholder;
		}
		
		var type = element.nodeName.toLowerCase();
		
		if (type == "textarea") {
			element.style.height = "0";

			if (cs.boxSizing == "border-box") {
				offset = element.offsetHeight;
			}
			else if (cs.boxSizing == "content-box") {
				offset = -element.clientHeight;
			}

			element.style.height = element.scrollHeight + offset + "px";
		}
		else if(type == "input") {
			element.style.width = "0";

			if (cs.boxSizing == "border-box") {
				offset = element.offsetWidth;
			}
			else if (cs.boxSizing == "padding-box") {
				offset = element.clientWidth;
			}

			// Safari misreports scrollWidth, so we will instead set scrollLeft to a
			// huge number, and read that back to see what it was clipped to
			element.scrollLeft = 1e+10;

			var width = Math.max(element.scrollLeft + offset, element.scrollWidth - element.clientWidth);

			element.style.width = width + "px";
		}
		else if (type == "select") {
			// Need to use dummy element to measure :(
			var option = document.createElement("_");
			option.textContent = element.options[element.selectedIndex].textContent;
			element.parentNode.insertBefore(option, element.nextSibling);

			// The name of the appearance property, as it might be prefixed
			var appearance;

			for (var property in cs) {
				if (!/^(width|webkitLogicalWidth)$/.test(property)) {
					//console.log(property, option.offsetWidth, cs[property]);
					option.style[property] = cs[property];

					if (/appearance$/i.test(property)) {
						appearance = property;
					}
				}
			}

			option.style.width = "";

			if (option.offsetWidth > 0) {
				element.style.width = option.offsetWidth + "px";

				if (!cs[appearance] || cs[appearance] !== "none") {
					// Account for arrow
					element.style.width = "calc(" + element.style.width + " + 2em)";
				}
			}

			option.parentNode.removeChild(option);
			option = null;
		}

		if (empty) {
			element.value = "";
		}
	},

	// Autosize multiple elements
	resizeAll: function(elements) {
		$$(elements || _.selectors.base).forEach(function (element) {
			_.resize(element);
		});	
	},

	active: true,

	// Will stretchy do anything for this element?
	resizes: function(element) {
		return element &&
		       element.parentNode &&
		       element.matches &&
		       element.matches(_.selectors.base) &&
		       element.matches(_.selectors.filter);
	},

	init: function(){
		_.selectors.filter = _.script.getAttribute("data-filter") ||
		                     ($$("[data-stretchy-filter]").pop() || document.body).getAttribute("data-stretchy-filter") || "*";

		_.resizeAll();
	},

	$$: $$
};

// Autosize all elements once the DOM is loaded

// DOM already loaded?
if (document.readyState !== "loading") {
	_.init();
}
else {
	// Wait for it
	document.addEventListener("DOMContentLoaded", _.init);
}

// Listen for changes
var listener = function(evt) {
	if (_.active) {
		_.resize(evt.target);
	}
};

document.body.addEventListener("input", listener);

// Firefox fires a change event instead of an input event
document.body.addEventListener("change", listener);

// Listen for new elements
if (self.MutationObserver) {
	(new MutationObserver(function(mutations) {
		if (_.active) {
			mutations.forEach(function(mutation) {
				if (mutation.type == "childList") {
					Stretchy.resizeAll(mutation.addedNodes);
				}
			});
		}
	})).observe(document.body, {
		childList: true,
		subtree: true
	});
}

})();
(function ($, $$) {

var _ = self.Wysie = $.Class({
	constructor: function (element) {
		_.all.push(this);

		var me = this;

		// TODO escaping of # and \
		var dataStore = element.getAttribute("data-store") || "#";
		this.store = dataStore === "none"? null : new URL(dataStore || this.id, location);

		// Assign a unique (for the page) id to this wysie instance
		this.id = element.id || "wysie-" + _.all.length;

		this.element = _.is("scope", element)? element : $(_.selectors.scope, element);

		if (!this.element) {
			element.setAttribute("typeof", "");
			this.element = element;
		}

		this.wrapper = element;

		if (element === this.element && _.is("multiple", element)) {
			this.wrapper = element.closest(".wysie-root") || $.create("div", {around: this.element});
		}

		this.wrapper.classList.add("wysie-root");

		element.removeAttribute("data-store");

		// Apply heuristic for collections
		$$("li:only-of-type, tr:only-of-type", this.wrapper).forEach(element=>{
			if (_.is("property", element) || _.is("scope", element)) {
				element.setAttribute("data-multiple", "");
			}
		});

		// Build wysie objects
		this.root = new (_.is("multiple", this.element)? _.Collection : _.Scope)(this.element, this);

		// Fetch existing data
		if (this.store && this.store.href) {
			this.storage = _.Storage.create(this);

			this.storage.load();
		}
		else {
			this.wrapper._.fire("wysie:load");
		}
	},

	get data() {
		return this.getData();
	},

	getData: function(o) {
		return this.root.getData(o);
	},

	toJSON: function() {
		return JSON.stringify(this.data, null, "\t");
	},

	render: function(data) {
		console.time("render");
		this.root.render(data.data || data);
		console.timeEnd("render");
	},

	save: function() {
		this.storage && this.storage.save();
	},

	live: {
		readonly: function(value) {
			this.wrapper.classList[value? "add" : "remove"]("readonly");
		}
	},

	static: {
		all: [],

		// Convert an identifier to readable text that can be used as a label
		readable: function (identifier) {
			// Is it camelCase?
			return identifier && identifier
			         .replace(/([a-z])([A-Z][a-z])/g, function($0, $1, $2) { return $1 + " " + $2.toLowerCase()}) // camelCase?
			         .replace(/([a-z])[_\/-](?=[a-z])/g, "$1 ") // Hyphen-separated / Underscore_separated?
			         .replace(/^[a-z]/, function($0) { return $0.toUpperCase() }); // Capitalize
		},

		// Inverse of _.readable(): Take a readable string and turn it into an identifier
		identifier: function (readable) {
			return readable && readable
			         .replace(/\s+/g, "-") // Convert whitespace to hyphens
			         .replace(/[^\w-]/g, "") // Remove weird characters
			         .toLowerCase();
		},

		queryJSON: function(data, path) {
			if (!path || !data) {
				return data;
			}

			path = path.split("/");

			for (var i=0, p; p=path[i++];) {
				if (!data) {
					return null;
				}

				data = data[p];
			}

			return data;
		},

		selectors: {
			property: "[property], [itemprop]",
			output: "[property=output], [itemprop=output], .output",
			primitive: "[property]:not([typeof]), [itemprop]:not([itemscope])",
			scope: "[typeof], [itemscope], [itemtype], .scope",
			multiple: "[multiple], [data-multiple], .multiple",
			required: "[required], [data-required], .required",
			formControl: "input, select, textarea",
			computed: ".computed" // Properties or scopes with computed properties, will not be saved
		},

		is: function(thing, element) {
			return element.matches && element.matches(_.selectors[thing]);
		}
	}
});

$.ready().then(evt=>{
	$$("[data-store]").forEach(function (element) {
		new Wysie(element);
	});
});

})(Bliss, Bliss.$);

// TODO implement this properly
function safeval(expr, vars) {
	with (vars) {
		try {
			return eval(expr);
		}
		catch (e) {
			return "ERROR!";
		}
	}
}

if (self.Promise && !Promise.prototype.done) {
	Promise.prototype.done = function(callback) {
		return this.then(callback, callback);
	};
}

(function($){

var _ = Wysie.Storage = $.Class({ abstract: true,

	constructor: function(wysie) {
		this.wysie = wysie;

		// Used in localStorage, in case the backend subclass modifies the URL
		this.originalHref = new URL(this.href, location);

		this.loaded = new Promise((resolve, reject)=>{
			this.wysie.wrapper.addEventListener("wysie:load", evt=>{resolve()});
		});
	},

	get url () {
		return this.wysie.store;
	},

	get href () {
		return this.url.href;
	},

	// localStorage backup (or only storage, in case of local Wysie instances)
	// TODO Switch to indexedDB
	get backup() {
		return JSON.parse(localStorage[this.originalHref] || null);
	},

	set backup(data) {
		localStorage[this.originalHref] = JSON.stringify(data, null, "\t");
	},

	// Is the storage ready?
	// To be be overriden by subclasses
	ready: Promise.resolve(),

	live: {
		inProgress: function(value) {
			if (value) {
				var p = $.create("div", {
					textContent: value + "…",
					className: "progress",
					inside: this.wysie.wrapper
				});
			}
			else {
				$.remove($(".progress", this.wysie.wrapper));
			}
		},

		loginToEdit: function(value) {
			if (value) {
				// #login authenticates if only 1 wysie on the page, or if the first.
				// Otherwise, we have to generate a slightly more complex hash
				this.loginHash = "#login" + (Wysie.all[0] === this.wysie? "" : "-" + this.wysie.id);

				this.authControls = $.create("aside", {
					className: "auth-controls",
					contents: [
						{
							tag: "a",
							href: this.loginHash,
							textContent: "Login to edit",
							className: "login",
							start: this.wysie.wrapper,
							events: {
								click: evt => {
									evt.preventDefault();
									this.login();
								}
							}
						}, {
							tag: "span",
							className: "status"
						}, {
							tag: "button",
							textContent: "Logout",
							className: "logout",
							events: {
								click: this.logout.bind(this)
							}
						}
					],
					start: this.wysie.wrapper
				});

				// We also support a hash to trigger login, in case the user doesn't want visible login UI
				window.addEventListener("hashchange", () => {
					if (location.hash === this.loginHash) {
						this.login();
						history.pushState(null, "", "#");
					}
				});

				if (location.hash === this.loginHash) {
					this.login();
					history.pushState(null, "", "#");
				}

				// Update login status
				this.wysie.wrapper.addEventListener("wysie:login", evt => {
					this.authControls.children[1].innerHTML = "Logged in to " + this.id + " as <strong>" + evt.name + "</strong>";
					Stretchy.resizeAll(); // TODO decouple
				});

				this.wysie.wrapper.addEventListener("wysie:logout", evt => {
					this.authControls.children[1].textContent = "";
				});

				return value;
			}
		},

		authenticated: function(value) {
			this.wysie.wrapper.classList[value? "add" : "remove"]("authenticated");
		}
	},

	load: function() {
		var ret = this.ready;
		var backup = this.backup;

		this.inProgress = "Loading";

		if (backup && backup.synced === false) {
			// Unsynced backup, we need to restore & then save instead of reading remote
			return ret.then(()=>{
				this.wysie.render(backup);
				this.inProgress = false;
				this.wysie.wrapper._.fire("wysie:load");

				return this.save();
			});
		}
		else {
			if (this.url.origin !== location.origin || this.url.pathname !== location.pathname) {
				// URL is not a hash, load it
				ret = ret.then(() => {

					return this.backendLoad? this.backendLoad() : $.fetch(this.href, {
						responseType: "json"
					});
				}).then(xhr => {
					this.inProgress = false;
					this.wysie.wrapper._.fire("wysie:load");
					// FIXME xhr.response cannot be expected in the case of this.backendLoad()
					var data = Wysie.queryJSON(xhr.response, this.url.hash.slice(1));

					this.wysie.render(data);

					this.backup = {
						synced: true,
						data: this.wysie.data
					};
				});
			}
			else {
				ret = ret.done(function(){
					// FIXME forcing the promise to fail to load locally is bad style
					return Promise.reject();
				});
			}

			return ret.catch(err => {
				this.inProgress = false;

				if (err) {
					console.error(err);
					console.log(err.stack);
				}

				if (backup) {
					this.wysie.render(backup);
				}

				this.wysie.wrapper._.fire("wysie:load");
			});
		}
	},

	save: function() {
		this.backup = {
			synced: !this._save,
			data: this.wysie.data
		};

		if (this.backendSave) {
			return this.login().then(()=>{
				this.inProgress = "Saving";

				return this.backendSave().then(()=>{
					var backup = this.backup;
					backup.synced = true;
					this.backup = backup;

					this.wysie.wrapper._.fire("wysie:save");
				}).done(()=>{
					this.inProgress = false;
				});
			});
		}
	},

	// To be overriden by subclasses
	// Subclasses should set this.authenticated
	login: () => Promise.resolve(),
	logout: () => Promise.resolve(),

	// Get storage parameters from the main element and cache them. Used for API keys and the like.
	param: function(id) {
		// TODO traverse all properties and cache params in constructor, to avoid
		// collection items carrying all of these
		this.params = this.params || {};

		if (!(id in this.params)) {
			var attribute = "data-store-" + id;

			this.params[id] = this.wysie.wrapper.getAttribute(attribute) || this.wysie.element.getAttribute(attribute);

			this.wysie.wrapper.removeAttribute(attribute);
			this.wysie.element.removeAttribute(attribute);
		}

		return this.params[id];
	},

	static: {
		// Factory method to return the right storage subclass for a given wysie object
		create: function(wysie) {
			var priority = -1;
			var Id;

			for (var id in _) {
				var backend = _[id];

				if (backend && backend.super === _ && backend.test(wysie.store)) {

					// Exists, is an backend and matches our URL!
					backend.priority = backend.priority || 0;

					if (priority <= backend.priority) {
						Id = id;
						priority = backend.priority;
					}
				}
			}

			if (Id) {
				var ret = new _[Id](wysie);
				ret.id = Id;
				return ret;
			}
			else {
				// No backend matched, using default
				return new _.Default(wysie);
			}
		}
	}
});

_.Default = $.Class({ extends: _,
	constructor: function() {
		// Can edit if local
		this.wysie.readonly = this.url.origin !== location.origin || this.url.pathname !== location.pathname;
	},

	static: {
		test: function() { return false; }
	}
});

})(Bliss);

/*
 * Wysie Unit: Super class that Scope and Primitive inherit from
 */
(function($, $$){

var _ = Wysie.Unit = $.Class({ abstract: true,
	constructor: function(element, wysie, collection) {
		if (!element || !wysie) {
			throw new Error("Wysie.Unit constructor requires an element argument and a wysie object");
		}

		this.wysie = wysie;
		this.element = element;
		this.element._.data.unit = this;

		this.property = _.normalizeProperty(this.element);
		this.collection = collection;

		this.computed = this.element.matches(Wysie.selectors.computed);

		// Scope this property belongs to
		this.parentScope = this.scope = this.property? this.element.closest(Wysie.selectors.scope) : null;

		if (this.scope === this.element) {
			this.parentScope = collection && collection.parentScope || this.scope.parentNode.closest(Wysie.selectors.scope);
		}

		this.required = this.element.matches("[required], [data-required]");
	},

	toJSON: Wysie.prototype.toJSON,

	get data() {
		return this.getData();
	},

	static: {
		create: function(element, wysie, collection) {
			if (!element || !wysie) {
				throw new TypeError("Wysie.Unit.create() requires an element argument and a wysie object");
			}

			var isScope = Wysie.is("scope", element)
				|| ( // Heuristic for matching scopes without a scoping attribute
					$$(Wysie.selectors.property, element).length // contains properties
					// TODO what if these properties are in another typeof?
					&& (
						Wysie.is("multiple", element)
						|| !element.matches("[data-attribute], [href], [src], time[datetime]") // content not in attribute
					)
				);

			return new Wysie[Wysie.Scope.is(element)? "Scope" : "Primitive"](element, wysie, collection);
		},

		normalizeProperty: function(element) {
			// Get & normalize property name, if exists
			var property = element.getAttribute("property") || element.getAttribute("itemprop");

			if (!property && element.hasAttribute("property")) {
				property = (element.getAttribute("class") || "").match(/^[^\s]*/)[0];
			}

			if (property) {
				element.setAttribute("property", property);
			}

			return property;
		},
	}
});

})(Bliss, Bliss.$);
(function($, $$){

var _ = Wysie.Scope = $.Class({
	extends: Wysie.Unit,
	constructor: function (element, wysie, collection) {
		var me = this;

		this.type = _.normalize(this.element);

		this.collections = $$(Wysie.selectors.multiple, element).map(function(template) {
			return new Wysie.Collection(template, me.wysie);
		}, this);

		// Create Wysie objects for all properties in this scope, primitives or scopes, but not properties in descendant scopes
		this.properties.forEach(prop => {
			prop._.data.unit = _.super.create(prop, this.wysie, this.collection);
		});

		// Handle expressions
		this.cacheReferences();

		this.element.addEventListener("wysie:propertychange", evt=>{
			evt.stopPropagation();
			this.updateReferences();
		});
		this.updateReferences();

		if (this.isRoot) {
			// TODO handle element templates in a better/more customizable way
			this.buttons = {
				edit: document.createElement("button")._.set({
					textContent: "✎",
					title: "Edit this " + this.type,
					className: "edit"
				}),
				savecancel: document.createElement("div")._.set({
					className: "wysie-buttons",
					contents: [{
						tag: "button",
						textContent: "Save",
						className: "save",
					}, {
						tag: "button",
						textContent: "Cancel",
						className: "cancel"
					}]
				})
			};

			this.element._.delegate({
				click: {
					"button.edit": this.edit.bind(this),
					"button.save": this.save.bind(this),
					"button.cancel": this.cancel.bind(this)
				},
				keyup: {
					"input": evt => {
						var code = evt.keyCode;

						if (code == 13) { // Enter
							this.save();
							evt.stopPropagation();
						}
						else if (code == 27) { // Esc
							this.cancel();
							evt.stopPropagation();
						}
					}
				}
			});

			// If root, add Save & Cancel button
			// TODO remove these after saving & cache, to reduce number of DOM elements lying around
			this.element.appendChild(this.buttons.edit);
		}

		// Monitor property additions or new references
		/*this.MutationObserver = new MutationObserver(records=>{
			records.forEach(record=>{
				console.log(record.type, record.target, $.value(record.addedNodes, "length"), record);
			});
		});
		this.MutationObserver.observe(this.element, {
			childList: true,
			subtree: true
		});*/
	},

	get isRoot() {
		return !this.property;
	},

	get properties () {
		// TODO cache this
		return $$(Wysie.selectors.property, this.element).filter(property=>{
			return this.element === property.parentNode.closest(Wysie.selectors.scope);
		});
	},

	get propertyNames () {
		return this.properties.map(property=>{
			return property._.data.unit.property;
		});
	},

	getData: function(o) {
		o = o || {};

		if (this.editing && !this.everSaved && !o.dirty
			|| this.computed && !o.computed) {
			return null;
		}

		var ret = {};

		this.properties.forEach(function(prop){
			var unit = prop._.data.unit;

			if (!unit.computed || o.computed) {
				ret[unit.property] = unit.getData(o);
			}
		});

		return ret;
	},

	live: {
		editing: {
			set: function(value) {
				if (value) {
					this.element.setAttribute("data-editing", "");
				}
				else {
					this.element.removeAttribute("data-editing");
				}
			}
		}
	},

	edit: function() {
		this.editing = true;

		if (this.isRoot) {
			this.element.removeChild(this.buttons.edit);
			this.element.appendChild(this.buttons.savecancel);
		}

		this.properties.forEach(function(prop){
			prop._.data.unit.edit();
		});

		this.collections.forEach(function (collection){
			if (collection.length === 0) {
				var item = collection.addEditable();
			}
		});
	},

	save: function() {
		// TODO make this a class when we handle references properly in classes so we can toggle other classes
		this.editing = false;

		if (this.isRoot) {
			$.remove(this.buttons.savecancel);
			this.element.appendChild(this.buttons.edit);
		}

		this.properties.forEach(function(prop){
			prop._.data.unit.save();
		}, this);

		this.everSaved = true;

		if (this.isRoot) {
			this.wysie.save();
		}
	},

	cancel: function() {
		if (this.isRoot) {
			$.remove(this.buttons.savecancel);
			this.element.appendChild(this.buttons.edit);
		}

		this.editing = false;

		this.properties.forEach(function(prop){
			prop._.data.unit.cancel();
		});
	},

	// Inject data in this element
	render: function(data) {
		if (!data) {
			return;
		}

		var unhandled = Object.keys(data).filter(property=>{
			return this.propertyNames.indexOf(property) === -1 && typeof data[property] != "object";
		});

		this.properties.forEach(prop => {
			var property = prop._.data.unit;

			var datum = Wysie.queryJSON(data, prop.getAttribute("property"));

			if (datum) {
				property.render(datum);
			}
		});

		unhandled.map(property=>{
			property = $.create("meta", {
				property: property,
				content: data[property],
				inside: this.element
			});

			property._.data.unit = Wysie.Unit.create(property, this.wysie, this.collection);

			return property;
		});

		this.collections.forEach(function (collection){
			collection.render(data[collection.property]);
		});

		this.everSaved = true;
	},

	cacheReferences: function() {
		var propertiesRegex = this.propertyNames.join("|");
		this.refRegex = RegExp("{(?:" + propertiesRegex + ")}|\\${.+?}", "gi");
		this.references = [];

		// TODO handle references when an attribute value is set later
		var extractRefs = (element, attribute) => {
			var text = attribute? attribute.value : element.textContent;
			var matches = text.match(this.refRegex);
			var propertyAttribute = $.value(element._.data.unit, "attribute");

			if (matches) {
				this.references.push({
					element: element,
					attribute: attribute && attribute.name,
					text: text,
					expressions: matches.map(match => {
						return {
							isSimple: match.indexOf("$") !== 0, // Is a simple property reference?
							expression: match.replace(/^\$?{|}$/g, ""),
							isProperty: Wysie.is("property", element) && attribute.name == propertyAttribute
						};
					})
				});
			}
		};

		(function traverse(element) {
			this.refRegex.lastIndex = 0;

			if (this.refRegex.test(element.outerHTML || element.textContent)) {
				$$(element.attributes).forEach(attribute => {
					extractRefs(element, attribute);
				});

				$$(element.childNodes).forEach(traverse, this);

				if (element.nodeType === 3) {
					// Leaf node, extract references from content
					extractRefs(element, null);
				}
			}
		}).call(this, this.element);

		this.updateReferences();
	},

	// Get data in JSON format, with ancestor and nested properties flattened,
	// iff they do not collide with properties of this scope.
	// Used in expressions.
	getRelativeData() {
		var scope = this;
		var data = {};

		// Get data of this scope and flatten ancestors
		while (scope) {
			var property = scope.property;
			data = $.extend(scope.getData({dirty: true, computed: true}), data);

			var parentScope = scope.parentScope;

			scope = parentScope && parentScope._.data.unit;
		}

		// Flatten nested objects
		(function flatten(obj) {
			$.each(obj, (key, value)=>{
				if (!(key in data)) {
					data[key] = value;
				}

				if ($.type(value) === "object") {
					flatten(value);
				}
			});
		}).call(this, data);

		return data;
	},

	// Gets called every time a property changes in this or descendant scopes
	// TODO special-case classes
	updateReferences: function() {
		if (!this.references.length) {
			return;
		}

		// Ancestor properties should also be added as on the same level,
		// with closer ancestors overriding higher up ancestors in case of collision
		data = this.getRelativeData();

		$$(this.references).forEach(ref => {
			var newText = ref.text;

			$$(ref.expressions).forEach(expr => {
				var value = expr.isSimple? data[expr.expression] : safeval(expr.expression, data);

				if (expr.isSimple && /^(class|id)$/i.test(ref.attribute)) {
					value = Wysie.identifier(value);
				}

				newText = newText.replace((expr.isSimple? "{" : "${") + expr.expression + "}", value || "");
			});

			if (ref.attribute) {
				ref.element.setAttribute(ref.attribute, newText);
			}
			else {
				ref.element.textContent = newText;
			}
		});
	},

	static: {
		is: function(element) {

			var ret = Wysie.is("scope", element);

			if (!ret) {
				// Heuristic for matching scopes without a scoping attribute
				if ($$(Wysie.selectors.property, element).length) { // Contains other properties and...
					ret = Wysie.is("multiple", element) // is a collection...
						// ...or its content is not in an attribute
						|| Wysie.Primitive.getValueAttribute(element) === null;
				}
			}

			return ret;
		},

		normalize: function(element) {
			// Get & normalize typeof name, if exists
			var type = element.getAttribute("typeof") || element.getAttribute("itemtype");

			if (!type && _.is(element)) {
				type = "Item";
			}

			if (type) {
				element.setAttribute("typeof", type);
			}

			return type;
		},
	}
});

})(Bliss, Bliss.$);

(function($, $$){

const DISABLE_CACHE = true;

var _ = Wysie.Primitive = $.Class({
	extends: Wysie.Unit,
	constructor: function (element, wysie, collection) {
		// Which attribute holds the data, if any?
		// "null" or null for none (i.e. data is in content).
		this.attribute = _.getValueAttribute(this.element);

		// What is the datatype?
		this.datatype = _.getDatatype(this.element, this.attribute);

		/**
		 * Set up input widget
		 */

		// Exposed widgets (visible always)
		if (Wysie.is("formControl", this.element)) {
			this.editor = this.element;

			if (this.exposed) {
				// Editing exposed elements saves the wysie
				this.element.addEventListener("change", evt => {
					if (evt.target === this.editor && (this.scope._.data.unit.everSaved || !this.scope.collection)) {
						this.wysie.save();
					}
				});

				this.edit();
			}
		}
		// Nested widgets
		else if (!this.editor) {
			this.editor = $$(this.element.children).filter(function (el) {
			    return el.matches(Wysie.selectors.formControl) && !el.matches(Wysie.selectors.property);
			})[0];

			$.remove(this.editor);
		}

		this.update(this.value);

		// Observe future mutations to this property, if possible
		// Properties like input.checked or input.value cannot be observed that way
		// so we cannot depend on mutation observers for everything :(
		if (!this.attribute) {
			// Data in content
			this.observer = new MutationObserver(record => {
				if (!this.editing) {
					this.update(this.value);
				}
			});

			this.observer.observe(this.element, {
				characterData: true,
				childList: true,
				subtree: true
			});
		}
		else if (!Wysie.is("formControl", this.element)) {
			// Data in attribute
			this.observer = new MutationObserver(record => {
				this.update(this.value);
			});

			this.observer.observe(this.element, {
				attributes: true,
				attributeFilter: [this.attribute]
			});
		}
	},

	get value() {
		if (this.editing || this.exposed) {
			return this.editorValue !== ""? this.editorValue : this.element.getAttribute(this.attribute || "content");
		}

		return _.getValue(this.element, this.attribute, this.datatype);
	},

	set value(value) {
		this.editorValue = value;

		_.setValue(this.element, value, this.attribute, this.datatype);

		if (Wysie.is("formControl", this.element) || !this.attribute) {
			// Mutation observer won't catch this, so we have to call update manually
			this.update(value);
		}
	},

	get editorValue() {
		if (this.editor) {
			if (this.editor.matches(Wysie.selectors.formControl)) {
				return _.getValue(this.editor, undefined, this.datatype);
			}

			// if we're here, this.editor is an entire HTML structure
			var output = $(Wysie.selectors.output + ", " + Wysie.selectors.formControl, this.editor);

			if (output) {
				return output._.data.unit ? output._.data.unit.value : _.getValue(output);
			}
		}
	},

	set editorValue(value) {
		if (this.editor) {
			_.setValue(this.editor, value, undefined, this.datatype);
		}
	},

	get exposed() {
		return this.editor === this.element;
	},

	getData: function(o) {
		o = o || {};

		if (this.computed && !o.computed) {
			return null;
		}

		return this.editing && !o.dirty? this.savedValue : this.value;
	},

	update: function (value) {
		this.element.classList[value !== "" && value !== null? "remove" : "add"]("empty");

		value = value || value === 0? value : "";

		if (this.humanReadable && this.attribute) {
			this.element.textContent = this.humanReadable(value);
		}

		this.element._.fire("wysie:propertychange", {
			property: this.property,
			value: value,
			wysie: this.wysie,
			unit: this,
			dirty: this.editing
		});
	},

	save: function () {
		if (this.element !== this.editor) {
			this.editing = false;
		}

		if (this.popup) {
			$.remove(this.popup);
			this.popup.classList.add("hidden");
		}
		else if (!this.attribute && !this.exposed) {
			this.element.textContent = this.editorValue;
			$.remove(this.editor);
		}

		$.unbind(this.element, this.elementEditEvents);
	},

	cancel: function() {
		this.value = this.savedValue;
		this.save();
	},

	edit: function () {
		if (this.savedValue === undefined) {
			// First time edit is called, set up editing UI
			this.label = this.label || Wysie.readable(this.property);

			// Linked widgets
			if (this.element.hasAttribute("data-input")) {
				var selector = this.element.getAttribute("data-input");

				if (selector) {
					this.editor = $.clone($(selector));

					if (!Wysie.is("formControl", this.editor)) {
						if ($(Wysie.selectors.output, this.editor)) { // has output element?
							// Process it as a wysie instance, so people can use references
							this.editor.setAttribute("data-store", "none");
							new Wysie(this.editor);
						}
						else {
							this.editor = null; // Cannot use this, sorry bro
						}
					}
				}
			}

			if (!this.editor) {
				// No editor provided, use default for element type
				// Find default editor for datatype
				var datatype = this.datatype.split(/\s+/);

				do {
					var editor = _.editors[datatype.join(" ")];
					datatype.shift();
				} while (!editor);

				editor = editor || _.editors.string;

				this.editor = $.type(editor) === "function"? editor.call(this) : $.create(editor);
			}

			this.editor._.events({
				"input": evt => {
					if (this.attribute) {
						this.element.setAttribute(this.attribute, this.editorValue);
					}

					if (this.exposed || !this.attribute) {
						this.update(this.editorValue);
					}
				},
				"focus": function () {
					this.select && this.select();
				},
				"keyup": evt => {
					if (this.popup && evt.keyCode == 13 || evt.keyCode == 27) {
						evt.stopPropagation();
						this.popup.classList.add("hidden");
					}
				},
				"wysie:propertychange": evt => {
					if (evt.property === "output") {
						evt.stopPropagation();
						$.fire(this.editor, "input");
					}
				}
			});

			if ("placeholder" in this.editor) {
				this.editor.placeholder = "(" + this.label + ")";
			}

			if (this.editor && this.editorValue !== "") {
				this.default = this.editorValue;
			}
			else {
				if (this.attribute) {
					this.default = this.element.getAttribute(this.attribute);
				}
				else if (this.editor.parentNode != this.element) {
					this.default = this.element.getAttribute("content") || this.element.textContent || null;
				}

				if (this.default !== null && this.editor) {
					this.editorValue = this.default;
				}
			}

			if (!this.exposed) {
				// Copy any data-input-* attributes from the element to the editor
				var dataInput = /^data-input-/i;
				$$(this.element.attributes).forEach(function (attribute) {
					if (dataInput.test(attribute.name)) {
						this.editor.setAttribute(attribute.name.replace(dataInput, ""), attribute.value);
					}
				}, this);

				if (this.attribute) {
					// Set up popup
					this.element.classList.add("using-popup");

					this.popup = this.popup || $.create("div", {
						className: "popup hidden",
						contents: [
							this.label + ":",
							this.editor
						],
						style: { // TODO what if it doesn’t fit?
							top: this.element.offsetTop + this.element.offsetHeight + "px",
							left: this.element.offsetLeft + "px"
						}
					});

					// No point in having a dropdown in a popup
					if (this.editor.matches("select")) {
						this.editor.size = Math.min(10, this.editor.children.length);
					}

					this.popup.addEventListener("focus", function() {
						this.classList.remove("hidden");
					}, true);

					this.popup.addEventListener("blur", function() {
						this.classList.add("hidden");
					}, true);
				}
			}
		}

		this.elementEditEvents = {
			"click": evt => {
				// Prevent default actions while editing
				if (evt.target !== this.editor) {
					evt.preventDefault();
					evt.stopPropagation();
				}

				if (this.element != document.activeElement) {
					this.popup.classList.toggle("hidden");
				}
			},
			"focus": evt => {
				this.popup.classList.remove("hidden");
			},
			"blur": evt => {
				this.popup.classList.add("hidden");
			}
		};

		this.element._.events(this.elementEditEvents);

		this.popup && this.popup._.after(this.element);

		this.savedValue = this.value;
		this.editing = true;

		if (!this.attribute) {
			if (this.editor.parentNode != this.element && !this.exposed) {
				this.editorValue = this.element.textContent;
				this.element.textContent = "";

				if (!this.exposed) {
					this.element.appendChild(this.editor);
				}
			}
		}
	},

	render: function(data) {
		this.value = data;
	},

	static: {
		getValueAttribute: function callee(element) {
			var ret = (callee.cache = callee.cache || new WeakMap()).get(element);

			if (ret === undefined || DISABLE_CACHE) {
				ret = element.getAttribute("data-attribute");

				if (!ret) {
					for (var selector in _.attributes) {
						if (element.matches(selector)) {
							ret = _.attributes[selector];
						}
					}
				}

				// TODO refactor this

				if (ret) {
					if (ret.humanReadable && element._.data.unit instanceof _) {
						element._.data.unit.humanReadable = ret.humanReadable;
					}

					ret = ret.value || ret;
				}

				if (!ret || ret === "null") {
					ret = null;
				}

				callee.cache.set(element, ret);
			}

			return ret;
		},

		getDatatype: function callee (element, attribute) {
			var ret = (callee.cache = callee.cache || new WeakMap()).get(element);

			if (ret === undefined || DISABLE_CACHE) {
				ret = element.getAttribute("datatype");

				if (!ret) {
					for (var selector in _.datatypes) {
						if (element.matches(selector)) {
							ret = _.datatypes[selector][attribute];
						}
					}
				}

				ret = ret || "string";

				callee.cache.set(element, ret);
			}

			return ret;
		},

		getValue: function callee(element, attribute, datatype) {
			var getter = (callee.cache = callee.cache || new WeakMap()).get(element);

			if (!getter || DISABLE_CACHE) {
				attribute = attribute || attribute === null? attribute : _.getValueAttribute(element);
				datatype = datatype || _.getDatatype(element, attribute);

				getter = function() {
					var ret;

					if (attribute in element) {
						// Returning properties (if they exist) instead of attributes
						// is needed for dynamic elements such as checkboxes, sliders etc
						ret = element[attribute];
					}
					else if (attribute) {
						ret = element.getAttribute(attribute);
					}
					else {
						ret = element.getAttribute("content") || element.textContent || null;
					}

					switch (datatype) {
						case "number": return +ret;
						case "boolean": return !!ret;
						default: return ret;
					}
				};

				callee.cache.set(element, getter);
			}

			return getter();
		},

		setValue: function callee(element, value, attribute, datatype) {
			var setter = (callee.cache = callee.cache || new WeakMap()).get(element);

			if (!setter || DISABLE_CACHE) {
				attribute = attribute || _.getValueAttribute(element);
				datatype = datatype || _.getDatatype(element, attribute);

				if (attribute in element) {
					// Returning properties (if they exist) instead of attributes
					// is needed for dynamic elements such as checkboxes, sliders etc
					setter = value => element[attribute] = value;
				}
				else if (attribute) {
					setter = value => element.setAttribute(attribute, value);
				}
				else {
					setter = value => element.textContent = value;
				}

				callee.cache.set(element, setter);
			}

			return setter(value);
		},
	}
});

// Define default attributes
_.attributes = {
	"img, video, audio": "src",
	"a, link": "href",
	"select, input, textarea": "value",
	"input[type=checkbox]": "checked",
	"time": {
		value: "datetime",
		humanReadable: function (value) {
			var date = new Date(value);

			if (!value || isNaN(date)) {
				return null;
			}

			// TODO do this properly (account for other datetime datatypes and different formats)
			var months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

			return date.getDate() + " " + months[date.getMonth()] + " " + date.getFullYear();
		}
	}
};

// Datatypes per attribute
_.datatypes = {
	"img": {
		"src": "image url"
	},
	"video": {
		"src": "video url"
	},
	"audio": {
		"src": "audio url"
	},
	"a, link": {
		"href": "url"
	},
	"input[type=checkbox]": {
		"checked": "boolean"
	},
	"input[type=range], input[type=number]": {
		"value": "number"
	},
	"time": {
		"datetime": "datetime",
	},
	"p, div": {
		"null": "multiline"
	},
	"address": {
		"null": "location"
	}
};

_.editors = {
	"string": {"tag": "input"},

	"url": {
		"tag": "input",
		"type": "url",
		"placeholder": "http://"
	},

	"multiline string": {tag: "textarea"},

	"datetime": function() {
		var types = {
			"date": /^[Y\d]{4}-[M\d]{2}-[D\d]{2}$/i,
			"month": /^[Y\d]{4}-[M\d]{2}$/i,
			"time": /^[H\d]{2}:[M\d]{2}/i,
			"week": /[Y\d]{4}-W[W\d]{2}$/i,
			"datetime-local": /^[Y\d]{4}-[M\d]{2}-[D\d]{2} [H\d]{2}:[M\d]{2}/i
		};

		var datetime = this.element.getAttribute("datetime") || "YYYY-MM-DD";

		for (var type in types) {
			if (types[type].test(datetime)) {
				break;
			}
		}

		return $.create("input", {type: type});
	}
};

})(Bliss, Bliss.$);

(function($, $$){

var _ = Wysie.Collection = function (template, wysie) {
	var me = this;

	if (!template || !wysie) {
		throw new TypeError("No template and/or Wysie object");
	}

	/*
	 * Create the template, remove it from the DOM and store it
	 */

	this.template = template;
	this.wysie = wysie;

	this.property = Wysie.Unit.normalizeProperty(this.template);
	this.type = Wysie.Scope.normalize(this.template);

	// Scope this collection belongs to (or null if root)
	this.parentScope = this.template.parentNode.closest(Wysie.selectors.scope);

	this.required = this.template.matches(Wysie.selectors.required);

	// Find add button if provided, or generate one
	var closestCollection = this.template.parentNode.closest(".wysie-item");
	this.addButton = $$("button.add-" + this.property + ", .wysie-add, button.add", closestCollection).filter(button => {
		return !this.template.contains(button);
	})[0];

	this.addButton = this.addButton || document.createElement("button")._.set({
		className: "add",
		textContent: "Add " + this.name
	});

	this.addButton.addEventListener("click", evt => {
		evt.preventDefault();
		this.addEditable();
	});

	/*
	 * Add new items at the top or bottom?
	 */
	if (this.template.hasAttribute("data-bottomup")) {
		// Attribute data-bottomup has the highest priority and overrides any heuristics
		this.bottomUp = true;
	}
	else if (!this.addButton.parentNode) {
		// If add button not in DOM, do the default
		this.bottomUp = false;
	}
	else {
		// If add button is already in the DOM and *before* our template, then we default to prepending
		this.bottomUp = !!(this.addButton.compareDocumentPosition(this.template) & Node.DOCUMENT_POSITION_FOLLOWING);
	}

	// Keep position of the template in the DOM, since we’re gonna remove it
	this.marker = $.create("div", {
		hidden: true, 
		className: "wysie-marker",
		after: this.template
	});

	this.template._.remove();

	["required", "multiple"].forEach(attr => {
		this.template.removeAttribute(attr);
		this.template.removeAttribute("data-" + attr);
	});

	this.template.classList.add("wysie-item");

	// Add events
	this.template._.delegate({
		"click": {
			"button.delete": function(evt) {
				if (confirm("Are you sure you want to " + evt.target.title.toLowerCase() + "?")) {
					me.delete(this);
				}

				evt.stopPropagation();
			}
		},
		"mouseover": {
			"button.delete": function(evt) {
				this.classList.add("delete-hover");

				evt.stopPropagation();
			}
		},
		"mouseout": {
			"button.delete": function(evt) {
				this.classList.remove("delete-hover");
				
				evt.stopPropagation();
			}
		}
	});

	// Add delete button to the template
	$.create({
		tag: "button",
		textContent: "✖",
		title: "Delete this " + this.name,
		className: "delete",
		inside: this.template
	});

	// TODO Add clone button to the template

	// Insert the add button if it's not already in the DOM
	if (!this.addButton.parentNode) {
		if (this.bottomUp) {
			this.addButton._.before(this.items[0] || this.marker);
		}
		else {
			this.addButton._.after(this.marker);
		}
	}

	this.wysie.wrapper.addEventListener("wysie:load", evt => {
		if (this.required && !this.length) {
			this.addEditable();
		}
	});
};

_.prototype = {
	get name() {
		return Wysie.readable(this.property || this.type).toLowerCase();
	},

	get selector() {
		return ".wysie-item" +
		       (this.property? '[property="' + this.property + '"]' : '') +
		       (this.type? '[typeof="' + this.type + '"]' : '');
	},

	get items() {
		return $$(this.selector, this.parentScope || this.wysie.wrapper);
	},

	get length() {
		return this.items.length;
	},

	get data() {
		return this.getData();
	},

	getData: function(o) {
		o = o || {};

		return this.items.map(function(item){
			var unit = item._.data.unit;

			return unit.getData(o);
		}).filter(function(item){
			return item !== null;
		});
	},

	toJSON: Wysie.prototype.toJSON,

	add: function() {
		var item = $.clone(this.template);

		Wysie.Unit.create(item, this.wysie, this);

		item._.before(this.marker);

		return item;
	},

	// TODO find a less stupid name?
	addEditable: function() {
		var item = $.clone(this.template);

		Wysie.Unit.create(item, this.wysie, this);

		item._.before(this.bottomUp? this.items[0] || this.marker : this.marker);

		item._.data.unit.edit();

		return item;
	},

	delete: function(item) {
		return $.transition(item, {opacity: 0}).then(()=>{
			$.remove(item);
			this.wysie.save();
		});
	},

	render: function(data) {
		if (!data) {
			return;
		}

		if (!Array.isArray(data) && typeof data === "object") {
			data = [data];
		}

		data.forEach(function(datum){
			var item = this.add();

			item._.data.unit.render(datum);
		}, this);
	}
};

})(Bliss, Bliss.$);
(function($){

if (!self.Wysie) {
	return;
}

var dropboxURL = "//cdnjs.cloudflare.com/ajax/libs/dropbox.js/0.10.2/dropbox.min.js";

var _ = Wysie.Storage.Dropbox = $.Class({ extends: Wysie.Storage,
	constructor: function() {
		this.wysie.readonly = true;
		this.loginToEdit = true;

		this.ready = $.include(self.Dropbox, dropboxURL).then((() => {
			var referrer = new URL(document.referrer);

			if (referrer.hostname === "www.dropbox.com" && location.hash.indexOf("#access_token=") === 0) {
				// We’re in an OAuth response popup, do what you need then close this
				Dropbox.AuthDriver.Popup.oauthReceiver();
				$.fire(window, "load"); // hack because dropbox.js didn't foresee use cases like ours :/
				close();
				return;
			}

			// Transform the dropbox shared URL into something raw and CORS-enabled
			this.wysie.store.hostname = "dl.dropboxusercontent.com";
			this.wysie.store.search = this.wysie.store.search.replace(/\bdl=0|^$/, "raw=1");

			// Internal filename (to be used for saving)
			this.filename = (this.param("path") || "") + (new URL(this.wysie.store)).pathname.match(/[^/]*$/)[0];

			this.client = new Dropbox.Client({ key: this.param("key") });
		})).then(()=>{
			this.login(true);
		});
	},

	// Super class save() calls this. Do not call directly.
	backendSave: function() {
		return this.upload({
			name: this.filename,
			data: this.wysie.toJSON()
		});
	},

	upload: function(file) {
		return new Promise((resolve, reject) => {
			this.client.writeFile(file.name, file.data, function(error, stat) {
				if (error) {
					return reject(Error(error));
				}

				console.log("Upload succeeded. File saved as revision " + stat.versionTag);
				resolve(stat);
			});
		});
	},

	login: function(passive) {
		return this.ready.then(()=>{
			return this.client.isAuthenticated()? Promise.resolve() : new Promise((resolve, reject) => {
				this.client.authDriver(new Dropbox.AuthDriver.Popup({
				    receiverUrl: new URL(location) + ""
				}));

				this.client.authenticate({interactive: !passive}, (error, client) => {

					if (error) {
						reject(Error(error));
					}

					if (this.client.isAuthenticated()) {
						this.authenticated = true;
						this.wysie.readonly = false;
						resolve();
					}
					else {
						this.authenticated = false;
						this.wysie.readonly = true;
						reject();
					}
				})
			})
		}).then(() => {
			// Not returning a promise here, since processes depending on login don't need to wait for this
			this.client.getAccountInfo((error, accountInfo) => {
				if (!error) {
					this.wysie.wrapper._.fire("wysie:login", accountInfo);
				}
			});
		}).catch(()=>{});
	},

	logout: function() {
		return !this.client.isAuthenticated()? Promise.resolve() : new Promise((resolve, reject) => {
			this.client.signOut(null, () => {
				this.authenticated = false;
				this.wysie.wrapper._.fire("wysie:logout");
				resolve();
			});
		});

	},

	static: {
		test: function(url) {
			return /dropbox.com/.test(url.host) || url.protocol === "dropbox:";
		}
	}
});

// TODO Storage adapter should only provide an upload method
// this should be implemented in Wysie.Primitive,
// as long as the current storage backend has an upload method
Wysie.Primitive.editors["image url"] = {
	create: function() {
		if (!this.wysie.storage.upload) {
			return;
		}

		var root = $.create("div", {
			className: "image-popup",
			events: {
				"dragenter dragover drop": function(evt) {
					evt.stopPropagation();
  					evt.preventDefault();
				},

				drop: function(evt) {
					var file = $.value(evt.dataTransfer, "files", 0);

					// Do upload stuff
				}
			},
			contents: [
			{
				tag: "label",
				contents: ["Image location: ", {
					tag: "input",
					type: "url"
				}]
			}, {
				tag: "input",
				type: "file",
				accept: "image/*",
				events: {
					change: function (evt) {
						var file = this.files[0];

						if (!file) {
							return;
						}

						// Show image locally
						$("img", root).file = file;

						// Upload to Dropbox

						// Once uploaded, share and get public URL

						// Set public URL as the value of the URL input
					}
				}
			}, {
				tag: "div",
				className: "image-preview",
				contents: [{
						tag: "progress",
						value: "0",
						max: "100"
					}, {
						tag: "img"
					}
				]
			}
		]});

		return root;
	},

	getValue: function() {
		return $("input[type=url]", this.popup).value;
	}
};

})(Bliss);
