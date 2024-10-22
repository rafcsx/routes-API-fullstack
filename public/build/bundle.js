
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
	'use strict';

	/** @returns {void} */
	function noop() {}

	const identity = (x) => x;

	/**
	 * @template T
	 * @template S
	 * @param {T} tar
	 * @param {S} src
	 * @returns {T & S}
	 */
	function assign(tar, src) {
		// @ts-ignore
		for (const k in src) tar[k] = src[k];
		return /** @type {T & S} */ (tar);
	}

	// Adapted from https://github.com/then/is-promise/blob/master/index.js
	// Distributed under MIT License https://github.com/then/is-promise/blob/master/LICENSE
	/**
	 * @param {any} value
	 * @returns {value is PromiseLike<any>}
	 */
	function is_promise(value) {
		return (
			!!value &&
			(typeof value === 'object' || typeof value === 'function') &&
			typeof (/** @type {any} */ (value).then) === 'function'
		);
	}

	/** @returns {void} */
	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	/**
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function run_all(fns) {
		fns.forEach(run);
	}

	/**
	 * @param {any} thing
	 * @returns {thing is Function}
	 */
	function is_function(thing) {
		return typeof thing === 'function';
	}

	/** @returns {boolean} */
	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
	}

	/** @returns {boolean} */
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
	}

	/** @returns {void} */
	function validate_store(store, name) {
		if (store != null && typeof store.subscribe !== 'function') {
			throw new Error(`'${name}' is not a store with a 'subscribe' method`);
		}
	}

	function subscribe(store, ...callbacks) {
		if (store == null) {
			for (const callback of callbacks) {
				callback(undefined);
			}
			return noop;
		}
		const unsub = store.subscribe(...callbacks);
		return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
	}

	/** @returns {void} */
	function component_subscribe(component, store, callback) {
		component.$$.on_destroy.push(subscribe(store, callback));
	}

	function create_slot(definition, ctx, $$scope, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, $$scope, fn) {
		return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
	}

	function get_slot_changes(definition, $$scope, dirty, fn) {
		if (definition[2] && fn) {
			const lets = definition[2](fn(dirty));
			if ($$scope.dirty === undefined) {
				return lets;
			}
			if (typeof lets === 'object') {
				const merged = [];
				const len = Math.max($$scope.dirty.length, lets.length);
				for (let i = 0; i < len; i += 1) {
					merged[i] = $$scope.dirty[i] | lets[i];
				}
				return merged;
			}
			return $$scope.dirty | lets;
		}
		return $$scope.dirty;
	}

	/** @returns {void} */
	function update_slot_base(
		slot,
		slot_definition,
		ctx,
		$$scope,
		slot_changes,
		get_slot_context_fn
	) {
		if (slot_changes) {
			const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
			slot.p(slot_context, slot_changes);
		}
	}

	/** @returns {any[] | -1} */
	function get_all_dirty_from_scope($$scope) {
		if ($$scope.ctx.length > 32) {
			const dirty = [];
			const length = $$scope.ctx.length / 32;
			for (let i = 0; i < length; i++) {
				dirty[i] = -1;
			}
			return dirty;
		}
		return -1;
	}

	/** @returns {{}} */
	function exclude_internal_props(props) {
		const result = {};
		for (const k in props) if (k[0] !== '$') result[k] = props[k];
		return result;
	}

	function null_to_empty(value) {
		return value == null ? '' : value;
	}

	const is_client = typeof window !== 'undefined';

	/** @type {() => number} */
	let now = is_client ? () => window.performance.now() : () => Date.now();

	let raf = is_client ? (cb) => requestAnimationFrame(cb) : noop;

	const tasks = new Set();

	/**
	 * @param {number} now
	 * @returns {void}
	 */
	function run_tasks(now) {
		tasks.forEach((task) => {
			if (!task.c(now)) {
				tasks.delete(task);
				task.f();
			}
		});
		if (tasks.size !== 0) raf(run_tasks);
	}

	/**
	 * Creates a new task that runs on each raf frame
	 * until it returns a falsy value or is aborted
	 * @param {import('./private.js').TaskCallback} callback
	 * @returns {import('./private.js').Task}
	 */
	function loop(callback) {
		/** @type {import('./private.js').TaskEntry} */
		let task;
		if (tasks.size === 0) raf(run_tasks);
		return {
			promise: new Promise((fulfill) => {
				tasks.add((task = { c: callback, f: fulfill }));
			}),
			abort() {
				tasks.delete(task);
			}
		};
	}

	/** @type {typeof globalThis} */
	const globals =
		typeof window !== 'undefined'
			? window
			: typeof globalThis !== 'undefined'
			? globalThis
			: // @ts-ignore Node typings have this
			  global;

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append(target, node) {
		target.appendChild(node);
	}

	/**
	 * @param {Node} node
	 * @returns {ShadowRoot | Document}
	 */
	function get_root_for_style(node) {
		if (!node) return document;
		const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
		if (root && /** @type {ShadowRoot} */ (root).host) {
			return /** @type {ShadowRoot} */ (root);
		}
		return node.ownerDocument;
	}

	/**
	 * @param {Node} node
	 * @returns {CSSStyleSheet}
	 */
	function append_empty_stylesheet(node) {
		const style_element = element('style');
		// For transitions to work without 'style-src: unsafe-inline' Content Security Policy,
		// these empty tags need to be allowed with a hash as a workaround until we move to the Web Animations API.
		// Using the hash for the empty string (for an empty tag) works in all browsers except Safari.
		// So as a workaround for the workaround, when we append empty style tags we set their content to /* empty */.
		// The hash 'sha256-9OlNO0DNEeaVzHL4RZwCLsBHA8WBQ8toBp/4F5XV2nc=' will then work even in Safari.
		style_element.textContent = '/* empty */';
		append_stylesheet(get_root_for_style(node), style_element);
		return style_element.sheet;
	}

	/**
	 * @param {ShadowRoot | Document} node
	 * @param {HTMLStyleElement} style
	 * @returns {CSSStyleSheet}
	 */
	function append_stylesheet(node, style) {
		append(/** @type {Document} */ (node).head || node, style);
		return style.sheet;
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach(node) {
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
	}

	/**
	 * @returns {void} */
	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	/**
	 * @template {keyof HTMLElementTagNameMap} K
	 * @param {K} name
	 * @returns {HTMLElementTagNameMap[K]}
	 */
	function element(name) {
		return document.createElement(name);
	}

	/**
	 * @param {string} data
	 * @returns {Text}
	 */
	function text(data) {
		return document.createTextNode(data);
	}

	/**
	 * @returns {Text} */
	function space() {
		return text(' ');
	}

	/**
	 * @returns {Text} */
	function empty() {
		return text('');
	}

	/**
	 * @param {EventTarget} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @returns {() => void}
	 */
	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
	}

	/**
	 * @param {Element} element
	 * @returns {ChildNode[]}
	 */
	function children(element) {
		return Array.from(element.childNodes);
	}

	/**
	 * @returns {void} */
	function set_input_value(input, value) {
		input.value = value == null ? '' : value;
	}

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @param {{ bubbles?: boolean, cancelable?: boolean }} [options]
	 * @returns {CustomEvent<T>}
	 */
	function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
		return new CustomEvent(type, { detail, bubbles, cancelable });
	}

	/**
	 * @typedef {Node & {
	 * 	claim_order?: number;
	 * 	hydrate_init?: true;
	 * 	actual_end_child?: NodeEx;
	 * 	childNodes: NodeListOf<NodeEx>;
	 * }} NodeEx
	 */

	/** @typedef {ChildNode & NodeEx} ChildNodeEx */

	/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

	/**
	 * @typedef {ChildNodeEx[] & {
	 * 	claim_info?: {
	 * 		last_index: number;
	 * 		total_claimed: number;
	 * 	};
	 * }} ChildNodeArray
	 */

	// we need to store the information for multiple documents because a Svelte application could also contain iframes
	// https://github.com/sveltejs/svelte/issues/3624
	/** @type {Map<Document | ShadowRoot, import('./private.d.ts').StyleInformation>} */
	const managed_styles = new Map();

	let active = 0;

	// https://github.com/darkskyapp/string-hash/blob/master/index.js
	/**
	 * @param {string} str
	 * @returns {number}
	 */
	function hash(str) {
		let hash = 5381;
		let i = str.length;
		while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
		return hash >>> 0;
	}

	/**
	 * @param {Document | ShadowRoot} doc
	 * @param {Element & ElementCSSInlineStyle} node
	 * @returns {{ stylesheet: any; rules: {}; }}
	 */
	function create_style_information(doc, node) {
		const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
		managed_styles.set(doc, info);
		return info;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {number} a
	 * @param {number} b
	 * @param {number} duration
	 * @param {number} delay
	 * @param {(t: number) => number} ease
	 * @param {(t: number, u: number) => string} fn
	 * @param {number} uid
	 * @returns {string}
	 */
	function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
		const step = 16.666 / duration;
		let keyframes = '{\n';
		for (let p = 0; p <= 1; p += step) {
			const t = a + (b - a) * ease(p);
			keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
		}
		const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
		const name = `__svelte_${hash(rule)}_${uid}`;
		const doc = get_root_for_style(node);
		const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
		if (!rules[name]) {
			rules[name] = true;
			stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
		}
		const animation = node.style.animation || '';
		node.style.animation = `${
		animation ? `${animation}, ` : ''
	}${name} ${duration}ms linear ${delay}ms 1 both`;
		active += 1;
		return name;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {string} [name]
	 * @returns {void}
	 */
	function delete_rule(node, name) {
		const previous = (node.style.animation || '').split(', ');
		const next = previous.filter(
			name
				? (anim) => anim.indexOf(name) < 0 // remove specific animation
				: (anim) => anim.indexOf('__svelte') === -1 // remove all Svelte animations
		);
		const deleted = previous.length - next.length;
		if (deleted) {
			node.style.animation = next.join(', ');
			active -= deleted;
			if (!active) clear_rules();
		}
	}

	/** @returns {void} */
	function clear_rules() {
		raf(() => {
			if (active) return;
			managed_styles.forEach((info) => {
				const { ownerNode } = info.stylesheet;
				// there is no ownerNode if it runs on jsdom.
				if (ownerNode) detach(ownerNode);
			});
			managed_styles.clear();
		});
	}

	let current_component;

	/** @returns {void} */
	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error('Function called outside component initialization');
		return current_component;
	}

	/**
	 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
	 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
	 * it can be called from an external module).
	 *
	 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
	 *
	 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
	 *
	 * https://svelte.dev/docs/svelte#onmount
	 * @template T
	 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
	 * @returns {void}
	 */
	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	/**
	 * Schedules a callback to run immediately before the component is unmounted.
	 *
	 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
	 * only one that runs inside a server-side component.
	 *
	 * https://svelte.dev/docs/svelte#ondestroy
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	/**
	 * Associates an arbitrary `context` object with the current component and the specified `key`
	 * and returns that object. The context is then available to children of the component
	 * (including slotted content) with `getContext`.
	 *
	 * Like lifecycle functions, this must be called during component initialisation.
	 *
	 * https://svelte.dev/docs/svelte#setcontext
	 * @template T
	 * @param {any} key
	 * @param {T} context
	 * @returns {T}
	 */
	function setContext(key, context) {
		get_current_component().$$.context.set(key, context);
		return context;
	}

	/**
	 * Retrieves the context that belongs to the closest parent component with the specified `key`.
	 * Must be called during component initialisation.
	 *
	 * https://svelte.dev/docs/svelte#getcontext
	 * @template T
	 * @param {any} key
	 * @returns {T}
	 */
	function getContext(key) {
		return get_current_component().$$.context.get(key);
	}

	const dirty_components = [];
	const binding_callbacks = [];

	let render_callbacks = [];

	const flush_callbacks = [];

	const resolved_promise = /* @__PURE__ */ Promise.resolve();

	let update_scheduled = false;

	/** @returns {void} */
	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	/** @returns {void} */
	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	// flush() calls callbacks in this order:
	// 1. All beforeUpdate callbacks, in order: parents before children
	// 2. All bind:this callbacks, in reverse order: children before parents.
	// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
	//    for afterUpdates called during the initial onMount, which are called in
	//    reverse order: children before parents.
	// Since callbacks might update component values, which could trigger another
	// call to flush(), the following steps guard against this:
	// 1. During beforeUpdate, any updated components will be added to the
	//    dirty_components array and will cause a reentrant call to flush(). Because
	//    the flush index is kept outside the function, the reentrant call will pick
	//    up where the earlier call left off and go through all dirty components. The
	//    current_component value is saved and restored so that the reentrant call will
	//    not interfere with the "parent" flush() call.
	// 2. bind:this callbacks cannot trigger new flush() calls.
	// 3. During afterUpdate, any updated components will NOT have their afterUpdate
	//    callback called a second time; the seen_callbacks set, outside the flush()
	//    function, guarantees this behavior.
	const seen_callbacks = new Set();

	let flushidx = 0; // Do *not* move this inside the flush() function

	/** @returns {void} */
	function flush() {
		// Do not reenter flush while dirty components are updated, as this can
		// result in an infinite loop. Instead, let the inner flush handle it.
		// Reentrancy is ok afterwards for bindings etc.
		if (flushidx !== 0) {
			return;
		}
		const saved_component = current_component;
		do {
			// first, call beforeUpdate functions
			// and update components
			try {
				while (flushidx < dirty_components.length) {
					const component = dirty_components[flushidx];
					flushidx++;
					set_current_component(component);
					update(component.$$);
				}
			} catch (e) {
				// reset dirty state to not end up in a deadlocked state and then rethrow
				dirty_components.length = 0;
				flushidx = 0;
				throw e;
			}
			set_current_component(null);
			dirty_components.length = 0;
			flushidx = 0;
			while (binding_callbacks.length) binding_callbacks.pop()();
			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			for (let i = 0; i < render_callbacks.length; i += 1) {
				const callback = render_callbacks[i];
				if (!seen_callbacks.has(callback)) {
					// ...so guard against infinite loops
					seen_callbacks.add(callback);
					callback();
				}
			}
			render_callbacks.length = 0;
		} while (dirty_components.length);
		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}
		update_scheduled = false;
		seen_callbacks.clear();
		set_current_component(saved_component);
	}

	/** @returns {void} */
	function update($$) {
		if ($$.fragment !== null) {
			$$.update();
			run_all($$.before_update);
			const dirty = $$.dirty;
			$$.dirty = [-1];
			$$.fragment && $$.fragment.p($$.ctx, dirty);
			$$.after_update.forEach(add_render_callback);
		}
	}

	/**
	 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function flush_render_callbacks(fns) {
		const filtered = [];
		const targets = [];
		render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
		targets.forEach((c) => c());
		render_callbacks = filtered;
	}

	/**
	 * @type {Promise<void> | null}
	 */
	let promise;

	/**
	 * @returns {Promise<void>}
	 */
	function wait() {
		if (!promise) {
			promise = Promise.resolve();
			promise.then(() => {
				promise = null;
			});
		}
		return promise;
	}

	/**
	 * @param {Element} node
	 * @param {INTRO | OUTRO | boolean} direction
	 * @param {'start' | 'end'} kind
	 * @returns {void}
	 */
	function dispatch(node, direction, kind) {
		node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
	}

	const outroing = new Set();

	/**
	 * @type {Outro}
	 */
	let outros;

	/**
	 * @returns {void} */
	function group_outros() {
		outros = {
			r: 0,
			c: [],
			p: outros // parent group
		};
	}

	/**
	 * @returns {void} */
	function check_outros() {
		if (!outros.r) {
			run_all(outros.c);
		}
		outros = outros.p;
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} [local]
	 * @returns {void}
	 */
	function transition_in(block, local) {
		if (block && block.i) {
			outroing.delete(block);
			block.i(local);
		}
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} local
	 * @param {0 | 1} [detach]
	 * @param {() => void} [callback]
	 * @returns {void}
	 */
	function transition_out(block, local, detach, callback) {
		if (block && block.o) {
			if (outroing.has(block)) return;
			outroing.add(block);
			outros.c.push(() => {
				outroing.delete(block);
				if (callback) {
					if (detach) block.d(1);
					callback();
				}
			});
			block.o(local);
		} else if (callback) {
			callback();
		}
	}

	/**
	 * @type {import('../transition/public.js').TransitionConfig}
	 */
	const null_transition = { duration: 0 };

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {TransitionFn} fn
	 * @param {any} params
	 * @returns {{ start(): void; invalidate(): void; end(): void; }}
	 */
	function create_in_transition(node, fn, params) {
		/**
		 * @type {TransitionOptions} */
		const options = { direction: 'in' };
		let config = fn(node, params, options);
		let running = false;
		let animation_name;
		let task;
		let uid = 0;

		/**
		 * @returns {void} */
		function cleanup() {
			if (animation_name) delete_rule(node, animation_name);
		}

		/**
		 * @returns {void} */
		function go() {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick = noop,
				css
			} = config || null_transition;
			if (css) animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
			tick(0, 1);
			const start_time = now() + delay;
			const end_time = start_time + duration;
			if (task) task.abort();
			running = true;
			add_render_callback(() => dispatch(node, true, 'start'));
			task = loop((now) => {
				if (running) {
					if (now >= end_time) {
						tick(1, 0);
						dispatch(node, true, 'end');
						cleanup();
						return (running = false);
					}
					if (now >= start_time) {
						const t = easing((now - start_time) / duration);
						tick(t, 1 - t);
					}
				}
				return running;
			});
		}
		let started = false;
		return {
			start() {
				if (started) return;
				started = true;
				delete_rule(node);
				if (is_function(config)) {
					config = config(options);
					wait().then(go);
				} else {
					go();
				}
			},
			invalidate() {
				started = false;
			},
			end() {
				if (running) {
					cleanup();
					running = false;
				}
			}
		};
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {TransitionFn} fn
	 * @param {any} params
	 * @returns {{ end(reset: any): void; }}
	 */
	function create_out_transition(node, fn, params) {
		/** @type {TransitionOptions} */
		const options = { direction: 'out' };
		let config = fn(node, params, options);
		let running = true;
		let animation_name;
		const group = outros;
		group.r += 1;
		/** @type {boolean} */
		let original_inert_value;

		/**
		 * @returns {void} */
		function go() {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick = noop,
				css
			} = config || null_transition;

			if (css) animation_name = create_rule(node, 1, 0, duration, delay, easing, css);

			const start_time = now() + delay;
			const end_time = start_time + duration;
			add_render_callback(() => dispatch(node, false, 'start'));

			if ('inert' in node) {
				original_inert_value = /** @type {HTMLElement} */ (node).inert;
				node.inert = true;
			}

			loop((now) => {
				if (running) {
					if (now >= end_time) {
						tick(0, 1);
						dispatch(node, false, 'end');
						if (!--group.r) {
							// this will result in `end()` being called,
							// so we don't need to clean up here
							run_all(group.c);
						}
						return false;
					}
					if (now >= start_time) {
						const t = easing((now - start_time) / duration);
						tick(1 - t, t);
					}
				}
				return running;
			});
		}

		if (is_function(config)) {
			wait().then(() => {
				// @ts-ignore
				config = config(options);
				go();
			});
		} else {
			go();
		}

		return {
			end(reset) {
				if (reset && 'inert' in node) {
					node.inert = original_inert_value;
				}
				if (reset && config.tick) {
					config.tick(1, 0);
				}
				if (running) {
					if (animation_name) delete_rule(node, animation_name);
					running = false;
				}
			}
		};
	}

	/** @typedef {1} INTRO */
	/** @typedef {0} OUTRO */
	/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
	/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

	/**
	 * @typedef {Object} Outro
	 * @property {number} r
	 * @property {Function[]} c
	 * @property {Object} p
	 */

	/**
	 * @typedef {Object} PendingProgram
	 * @property {number} start
	 * @property {INTRO|OUTRO} b
	 * @property {Outro} [group]
	 */

	/**
	 * @typedef {Object} Program
	 * @property {number} a
	 * @property {INTRO|OUTRO} b
	 * @property {1|-1} d
	 * @property {number} duration
	 * @property {number} start
	 * @property {number} end
	 * @property {Outro} [group]
	 */

	/**
	 * @template T
	 * @param {Promise<T>} promise
	 * @param {import('./private.js').PromiseInfo<T>} info
	 * @returns {boolean}
	 */
	function handle_promise(promise, info) {
		const token = (info.token = {});
		/**
		 * @param {import('./private.js').FragmentFactory} type
		 * @param {0 | 1 | 2} index
		 * @param {number} [key]
		 * @param {any} [value]
		 * @returns {void}
		 */
		function update(type, index, key, value) {
			if (info.token !== token) return;
			info.resolved = value;
			let child_ctx = info.ctx;
			if (key !== undefined) {
				child_ctx = child_ctx.slice();
				child_ctx[key] = value;
			}
			const block = type && (info.current = type)(child_ctx);
			let needs_flush = false;
			if (info.block) {
				if (info.blocks) {
					info.blocks.forEach((block, i) => {
						if (i !== index && block) {
							group_outros();
							transition_out(block, 1, 1, () => {
								if (info.blocks[i] === block) {
									info.blocks[i] = null;
								}
							});
							check_outros();
						}
					});
				} else {
					info.block.d(1);
				}
				block.c();
				transition_in(block, 1);
				block.m(info.mount(), info.anchor);
				needs_flush = true;
			}
			info.block = block;
			if (info.blocks) info.blocks[index] = block;
			if (needs_flush) {
				flush();
			}
		}
		if (is_promise(promise)) {
			const current_component = get_current_component();
			promise.then(
				(value) => {
					set_current_component(current_component);
					update(info.then, 1, info.value, value);
					set_current_component(null);
				},
				(error) => {
					set_current_component(current_component);
					update(info.catch, 2, info.error, error);
					set_current_component(null);
					if (!info.hasCatch) {
						throw error;
					}
				}
			);
			// if we previously had a then/catch block, destroy it
			if (info.current !== info.pending) {
				update(info.pending, 0);
				return true;
			}
		} else {
			if (info.current !== info.then) {
				update(info.then, 1, info.value, promise);
				return true;
			}
			info.resolved = /** @type {T} */ (promise);
		}
	}

	/** @returns {void} */
	function update_await_block_branch(info, ctx, dirty) {
		const child_ctx = ctx.slice();
		const { resolved } = info;
		if (info.current === info.then) {
			child_ctx[info.value] = resolved;
		}
		if (info.current === info.catch) {
			child_ctx[info.error] = resolved;
		}
		info.block.p(child_ctx, dirty);
	}

	// general each functions:

	function ensure_array_like(array_like_or_iterator) {
		return array_like_or_iterator?.length !== undefined
			? array_like_or_iterator
			: Array.from(array_like_or_iterator);
	}

	/** @returns {{}} */
	function get_spread_update(levels, updates) {
		const update = {};
		const to_null_out = {};
		const accounted_for = { $$scope: 1 };
		let i = levels.length;
		while (i--) {
			const o = levels[i];
			const n = updates[i];
			if (n) {
				for (const key in o) {
					if (!(key in n)) to_null_out[key] = 1;
				}
				for (const key in n) {
					if (!accounted_for[key]) {
						update[key] = n[key];
						accounted_for[key] = 1;
					}
				}
				levels[i] = n;
			} else {
				for (const key in o) {
					accounted_for[key] = 1;
				}
			}
		}
		for (const key in to_null_out) {
			if (!(key in update)) update[key] = undefined;
		}
		return update;
	}

	function get_spread_object(spread_props) {
		return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
	}

	/** @returns {void} */
	function create_component(block) {
		block && block.c();
	}

	/** @returns {void} */
	function mount_component(component, target, anchor) {
		const { fragment, after_update } = component.$$;
		fragment && fragment.m(target, anchor);
		// onMount happens before the initial afterUpdate
		add_render_callback(() => {
			const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
			// if the component was destroyed immediately
			// it will update the `$$.on_destroy` reference to `null`.
			// the destructured on_destroy may still reference to the old array
			if (component.$$.on_destroy) {
				component.$$.on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});
		after_update.forEach(add_render_callback);
	}

	/** @returns {void} */
	function destroy_component(component, detaching) {
		const $$ = component.$$;
		if ($$.fragment !== null) {
			flush_render_callbacks($$.after_update);
			run_all($$.on_destroy);
			$$.fragment && $$.fragment.d(detaching);
			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			$$.on_destroy = $$.fragment = null;
			$$.ctx = [];
		}
	}

	/** @returns {void} */
	function make_dirty(component, i) {
		if (component.$$.dirty[0] === -1) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty.fill(0);
		}
		component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
	}

	// TODO: Document the other params
	/**
	 * @param {SvelteComponent} component
	 * @param {import('./public.js').ComponentConstructorOptions} options
	 *
	 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
	 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
	 * This will be the `add_css` function from the compiled component.
	 *
	 * @returns {void}
	 */
	function init(
		component,
		options,
		instance,
		create_fragment,
		not_equal,
		props,
		append_styles = null,
		dirty = [-1]
	) {
		const parent_component = current_component;
		set_current_component(component);
		/** @type {import('./private.js').T$$} */
		const $$ = (component.$$ = {
			fragment: null,
			ctx: [],
			// state
			props,
			update: noop,
			not_equal,
			bound: blank_object(),
			// lifecycle
			on_mount: [],
			on_destroy: [],
			on_disconnect: [],
			before_update: [],
			after_update: [],
			context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
			// everything else
			callbacks: blank_object(),
			dirty,
			skip_bound: false,
			root: options.target || parent_component.$$.root
		});
		append_styles && append_styles($$.root);
		let ready = false;
		$$.ctx = instance
			? instance(component, options.props || {}, (i, ret, ...rest) => {
					const value = rest.length ? rest[0] : ret;
					if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
						if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
						if (ready) make_dirty(component, i);
					}
					return ret;
			  })
			: [];
		$$.update();
		ready = true;
		run_all($$.before_update);
		// `false` as a special case of no DOM component
		$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
		if (options.target) {
			if (options.hydrate) {
				// TODO: what is the correct type here?
				// @ts-expect-error
				const nodes = children(options.target);
				$$.fragment && $$.fragment.l(nodes);
				nodes.forEach(detach);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.c();
			}
			if (options.intro) transition_in(component.$$.fragment);
			mount_component(component, options.target, options.anchor);
			flush();
		}
		set_current_component(parent_component);
	}

	/**
	 * Base class for Svelte components. Used when dev=false.
	 *
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 */
	class SvelteComponent {
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$ = undefined;
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$set = undefined;

		/** @returns {void} */
		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}

		/**
		 * @template {Extract<keyof Events, string>} K
		 * @param {K} type
		 * @param {((e: Events[K]) => void) | null | undefined} callback
		 * @returns {() => void}
		 */
		$on(type, callback) {
			if (!is_function(callback)) {
				return noop;
			}
			const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		/**
		 * @param {Partial<Props>} props
		 * @returns {void}
		 */
		$set(props) {
			if (this.$$set && !is_empty(props)) {
				this.$$.skip_bound = true;
				this.$$set(props);
				this.$$.skip_bound = false;
			}
		}
	}

	/**
	 * @typedef {Object} CustomElementPropDefinition
	 * @property {string} [attribute]
	 * @property {boolean} [reflect]
	 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
	 */

	// generated during release, do not modify

	/**
	 * The current version, as set in package.json.
	 *
	 * https://svelte.dev/docs/svelte-compiler#svelte-version
	 * @type {string}
	 */
	const VERSION = '4.2.19';
	const PUBLIC_VERSION = '4';

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @returns {void}
	 */
	function dispatch_dev(type, detail) {
		document.dispatchEvent(custom_event(type, { version: VERSION, ...detail }, { bubbles: true }));
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append_dev(target, node) {
		dispatch_dev('SvelteDOMInsert', { target, node });
		append(target, node);
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert_dev(target, node, anchor) {
		dispatch_dev('SvelteDOMInsert', { target, node, anchor });
		insert(target, node, anchor);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach_dev(node) {
		dispatch_dev('SvelteDOMRemove', { node });
		detach(node);
	}

	/**
	 * @param {Node} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @param {boolean} [has_prevent_default]
	 * @param {boolean} [has_stop_propagation]
	 * @param {boolean} [has_stop_immediate_propagation]
	 * @returns {() => void}
	 */
	function listen_dev(
		node,
		event,
		handler,
		options,
		has_prevent_default,
		has_stop_propagation,
		has_stop_immediate_propagation
	) {
		const modifiers =
			options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
		if (has_prevent_default) modifiers.push('preventDefault');
		if (has_stop_propagation) modifiers.push('stopPropagation');
		if (has_stop_immediate_propagation) modifiers.push('stopImmediatePropagation');
		dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
		const dispose = listen(node, event, handler, options);
		return () => {
			dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
			dispose();
		};
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr_dev(node, attribute, value) {
		attr(node, attribute, value);
		if (value == null) dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
		else dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
	}

	/**
	 * @param {Element} node
	 * @param {string} property
	 * @param {any} [value]
	 * @returns {void}
	 */
	function prop_dev(node, property, value) {
		node[property] = value;
		dispatch_dev('SvelteDOMSetProperty', { node, property, value });
	}

	/**
	 * @param {Text} text
	 * @param {unknown} data
	 * @returns {void}
	 */
	function set_data_dev(text, data) {
		data = '' + data;
		if (text.data === data) return;
		dispatch_dev('SvelteDOMSetData', { node: text, data });
		text.data = /** @type {string} */ (data);
	}

	function ensure_array_like_dev(arg) {
		if (
			typeof arg !== 'string' &&
			!(arg && typeof arg === 'object' && 'length' in arg) &&
			!(typeof Symbol === 'function' && arg && Symbol.iterator in arg)
		) {
			throw new Error('{#each} only works with iterable values.');
		}
		return ensure_array_like(arg);
	}

	/**
	 * @returns {void} */
	function validate_slots(name, slot, keys) {
		for (const slot_key of Object.keys(slot)) {
			if (!~keys.indexOf(slot_key)) {
				console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
			}
		}
	}

	function construct_svelte_component_dev(component, props) {
		const error_message = 'this={...} of <svelte:component> should specify a Svelte component.';
		try {
			const instance = new component(props);
			if (!instance.$$ || !instance.$set || !instance.$on || !instance.$destroy) {
				throw new Error(error_message);
			}
			return instance;
		} catch (err) {
			const { message } = err;
			if (typeof message === 'string' && message.indexOf('is not a constructor') !== -1) {
				throw new Error(error_message);
			} else {
				throw err;
			}
		}
	}

	/**
	 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
	 *
	 * Can be used to create strongly typed Svelte components.
	 *
	 * #### Example:
	 *
	 * You have component library on npm called `component-library`, from which
	 * you export a component called `MyComponent`. For Svelte+TypeScript users,
	 * you want to provide typings. Therefore you create a `index.d.ts`:
	 * ```ts
	 * import { SvelteComponent } from "svelte";
	 * export class MyComponent extends SvelteComponent<{foo: string}> {}
	 * ```
	 * Typing this makes it possible for IDEs like VS Code with the Svelte extension
	 * to provide intellisense and to use the component like this in a Svelte file
	 * with TypeScript:
	 * ```svelte
	 * <script lang="ts">
	 * 	import { MyComponent } from "component-library";
	 * </script>
	 * <MyComponent foo={'bar'} />
	 * ```
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 * @template {Record<string, any>} [Slots=any]
	 * @extends {SvelteComponent<Props, Events>}
	 */
	class SvelteComponentDev extends SvelteComponent {
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Props}
		 */
		$$prop_def;
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Events}
		 */
		$$events_def;
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Slots}
		 */
		$$slot_def;

		/** @param {import('./public.js').ComponentConstructorOptions<Props>} options */
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error("'target' is a required option");
			}
			super();
		}

		/** @returns {void} */
		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn('Component was already destroyed'); // eslint-disable-line no-console
			};
		}

		/** @returns {void} */
		$capture_state() {}

		/** @returns {void} */
		$inject_state() {}
	}

	if (typeof window !== 'undefined')
		// @ts-ignore
		(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

	const LOCATION = {};
	const ROUTER = {};
	const HISTORY = {};

	/**
	 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
	 * https://github.com/reach/router/blob/master/LICENSE
	 */

	const PARAM = /^:(.+)/;
	const SEGMENT_POINTS = 4;
	const STATIC_POINTS = 3;
	const DYNAMIC_POINTS = 2;
	const SPLAT_PENALTY = 1;
	const ROOT_POINTS = 1;

	/**
	 * Split up the URI into segments delimited by `/`
	 * Strip starting/ending `/`
	 * @param {string} uri
	 * @return {string[]}
	 */
	const segmentize = (uri) => uri.replace(/(^\/+|\/+$)/g, "").split("/");
	/**
	 * Strip `str` of potential start and end `/`
	 * @param {string} string
	 * @return {string}
	 */
	const stripSlashes = (string) => string.replace(/(^\/+|\/+$)/g, "");
	/**
	 * Score a route depending on how its individual segments look
	 * @param {object} route
	 * @param {number} index
	 * @return {object}
	 */
	const rankRoute = (route, index) => {
	    const score = route.default
	        ? 0
	        : segmentize(route.path).reduce((score, segment) => {
	              score += SEGMENT_POINTS;

	              if (segment === "") {
	                  score += ROOT_POINTS;
	              } else if (PARAM.test(segment)) {
	                  score += DYNAMIC_POINTS;
	              } else if (segment[0] === "*") {
	                  score -= SEGMENT_POINTS + SPLAT_PENALTY;
	              } else {
	                  score += STATIC_POINTS;
	              }

	              return score;
	          }, 0);

	    return { route, score, index };
	};
	/**
	 * Give a score to all routes and sort them on that
	 * If two routes have the exact same score, we go by index instead
	 * @param {object[]} routes
	 * @return {object[]}
	 */
	const rankRoutes = (routes) =>
	    routes
	        .map(rankRoute)
	        .sort((a, b) =>
	            a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
	        );
	/**
	 * Ranks and picks the best route to match. Each segment gets the highest
	 * amount of points, then the type of segment gets an additional amount of
	 * points where
	 *
	 *  static > dynamic > splat > root
	 *
	 * This way we don't have to worry about the order of our routes, let the
	 * computers do it.
	 *
	 * A route looks like this
	 *
	 *  { path, default, value }
	 *
	 * And a returned match looks like:
	 *
	 *  { route, params, uri }
	 *
	 * @param {object[]} routes
	 * @param {string} uri
	 * @return {?object}
	 */
	const pick = (routes, uri) => {
	    let match;
	    let default_;

	    const [uriPathname] = uri.split("?");
	    const uriSegments = segmentize(uriPathname);
	    const isRootUri = uriSegments[0] === "";
	    const ranked = rankRoutes(routes);

	    for (let i = 0, l = ranked.length; i < l; i++) {
	        const route = ranked[i].route;
	        let missed = false;

	        if (route.default) {
	            default_ = {
	                route,
	                params: {},
	                uri,
	            };
	            continue;
	        }

	        const routeSegments = segmentize(route.path);
	        const params = {};
	        const max = Math.max(uriSegments.length, routeSegments.length);
	        let index = 0;

	        for (; index < max; index++) {
	            const routeSegment = routeSegments[index];
	            const uriSegment = uriSegments[index];

	            if (routeSegment && routeSegment[0] === "*") {
	                // Hit a splat, just grab the rest, and return a match
	                // uri:   /files/documents/work
	                // route: /files/* or /files/*splatname
	                const splatName =
	                    routeSegment === "*" ? "*" : routeSegment.slice(1);

	                params[splatName] = uriSegments
	                    .slice(index)
	                    .map(decodeURIComponent)
	                    .join("/");
	                break;
	            }

	            if (typeof uriSegment === "undefined") {
	                // URI is shorter than the route, no match
	                // uri:   /users
	                // route: /users/:userId
	                missed = true;
	                break;
	            }

	            const dynamicMatch = PARAM.exec(routeSegment);

	            if (dynamicMatch && !isRootUri) {
	                const value = decodeURIComponent(uriSegment);
	                params[dynamicMatch[1]] = value;
	            } else if (routeSegment !== uriSegment) {
	                // Current segments don't match, not dynamic, not splat, so no match
	                // uri:   /users/123/settings
	                // route: /users/:id/profile
	                missed = true;
	                break;
	            }
	        }

	        if (!missed) {
	            match = {
	                route,
	                params,
	                uri: "/" + uriSegments.slice(0, index).join("/"),
	            };
	            break;
	        }
	    }

	    return match || default_ || null;
	};
	/**
	 * Combines the `basepath` and the `path` into one path.
	 * @param {string} basepath
	 * @param {string} path
	 */
	const combinePaths = (basepath, path) =>
	    `${stripSlashes(
        path === "/"
            ? basepath
            : `${stripSlashes(basepath)}/${stripSlashes(path)}`
    )}/`;

	const canUseDOM = () =>
	    typeof window !== "undefined" &&
	    "document" in window &&
	    "location" in window;

	/* node_modules/svelte-routing/src/Route.svelte generated by Svelte v4.2.19 */
	const get_default_slot_changes$1 = dirty => ({ params: dirty & /*routeParams*/ 4 });
	const get_default_slot_context$1 = ctx => ({ params: /*routeParams*/ ctx[2] });

	// (42:0) {#if $activeRoute && $activeRoute.route === route}
	function create_if_block$5(ctx) {
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block_1$2, create_else_block$4];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*component*/ ctx[0]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				if_block.c();
				if_block_anchor = empty();
			},
			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert_dev(target, if_block_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$5.name,
			type: "if",
			source: "(42:0) {#if $activeRoute && $activeRoute.route === route}",
			ctx
		});

		return block;
	}

	// (51:4) {:else}
	function create_else_block$4(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[8].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], get_default_slot_context$1);

		const block = {
			c: function create() {
				if (default_slot) default_slot.c();
			},
			m: function mount(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p: function update(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope, routeParams*/ 132)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[7],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, get_default_slot_changes$1),
							get_default_slot_context$1
						);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$4.name,
			type: "else",
			source: "(51:4) {:else}",
			ctx
		});

		return block;
	}

	// (43:4) {#if component}
	function create_if_block_1$2(ctx) {
		let await_block_anchor;
		let promise;
		let current;

		let info = {
			ctx,
			current: null,
			token: null,
			hasCatch: false,
			pending: create_pending_block,
			then: create_then_block,
			catch: create_catch_block,
			value: 12,
			blocks: [,,,]
		};

		handle_promise(promise = /*component*/ ctx[0], info);

		const block = {
			c: function create() {
				await_block_anchor = empty();
				info.block.c();
			},
			m: function mount(target, anchor) {
				insert_dev(target, await_block_anchor, anchor);
				info.block.m(target, info.anchor = anchor);
				info.mount = () => await_block_anchor.parentNode;
				info.anchor = await_block_anchor;
				current = true;
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
				info.ctx = ctx;

				if (dirty & /*component*/ 1 && promise !== (promise = /*component*/ ctx[0]) && handle_promise(promise, info)) ; else {
					update_await_block_branch(info, ctx, dirty);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(info.block);
				current = true;
			},
			o: function outro(local) {
				for (let i = 0; i < 3; i += 1) {
					const block = info.blocks[i];
					transition_out(block);
				}

				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(await_block_anchor);
				}

				info.block.d(detaching);
				info.token = null;
				info = null;
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$2.name,
			type: "if",
			source: "(43:4) {#if component}",
			ctx
		});

		return block;
	}

	// (1:0) <script>     import { getContext, onDestroy }
	function create_catch_block(ctx) {
		const block = {
			c: noop,
			m: noop,
			p: noop,
			i: noop,
			o: noop,
			d: noop
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_catch_block.name,
			type: "catch",
			source: "(1:0) <script>     import { getContext, onDestroy }",
			ctx
		});

		return block;
	}

	// (44:49)              <svelte:component                 this={resolvedComponent?.default || resolvedComponent}
	function create_then_block(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;
		const switch_instance_spread_levels = [/*routeParams*/ ctx[2], /*routeProps*/ ctx[3]];
		var switch_value = /*resolvedComponent*/ ctx[12]?.default || /*resolvedComponent*/ ctx[12];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {};

			for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
				switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
			}

			if (dirty !== undefined && dirty & /*routeParams, routeProps*/ 12) {
				switch_instance_props = assign(switch_instance_props, get_spread_update(switch_instance_spread_levels, [
					dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
					dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
				]));
			}

			return {
				props: switch_instance_props,
				$$inline: true
			};
		}

		if (switch_value) {
			switch_instance = construct_svelte_component_dev(switch_value, switch_props(ctx));
		}

		const block = {
			c: function create() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m: function mount(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert_dev(target, switch_instance_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (dirty & /*component*/ 1 && switch_value !== (switch_value = /*resolvedComponent*/ ctx[12]?.default || /*resolvedComponent*/ ctx[12])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component_dev(switch_value, switch_props(ctx, dirty));
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty & /*routeParams, routeProps*/ 12)
					? get_spread_update(switch_instance_spread_levels, [
							dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
							dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
						])
					: {};

					switch_instance.$set(switch_instance_changes);
				}
			},
			i: function intro(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(switch_instance_anchor);
				}

				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_then_block.name,
			type: "then",
			source: "(44:49)              <svelte:component                 this={resolvedComponent?.default || resolvedComponent}",
			ctx
		});

		return block;
	}

	// (1:0) <script>     import { getContext, onDestroy }
	function create_pending_block(ctx) {
		const block = {
			c: noop,
			m: noop,
			p: noop,
			i: noop,
			o: noop,
			d: noop
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_pending_block.name,
			type: "pending",
			source: "(1:0) <script>     import { getContext, onDestroy }",
			ctx
		});

		return block;
	}

	function create_fragment$7(ctx) {
		let if_block_anchor;
		let current;
		let if_block = /*$activeRoute*/ ctx[1] && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[5] && create_if_block$5(ctx);

		const block = {
			c: function create() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert_dev(target, if_block_anchor, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (/*$activeRoute*/ ctx[1] && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[5]) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty & /*$activeRoute*/ 2) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block$5(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(if_block_anchor);
				}

				if (if_block) if_block.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$7.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$7($$self, $$props, $$invalidate) {
		let $activeRoute;
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Route', slots, ['default']);
		let { path = "" } = $$props;
		let { component = null } = $$props;
		let routeParams = {};
		let routeProps = {};
		const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
		validate_store(activeRoute, 'activeRoute');
		component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));

		const route = {
			path,
			// If no path prop is given, this Route will act as the default Route
			// that is rendered if no other Route in the Router is a match.
			default: path === ""
		};

		registerRoute(route);

		onDestroy(() => {
			unregisterRoute(route);
		});

		$$self.$$set = $$new_props => {
			$$invalidate(11, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
			if ('path' in $$new_props) $$invalidate(6, path = $$new_props.path);
			if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
			if ('$$scope' in $$new_props) $$invalidate(7, $$scope = $$new_props.$$scope);
		};

		$$self.$capture_state = () => ({
			getContext,
			onDestroy,
			ROUTER,
			canUseDOM,
			path,
			component,
			routeParams,
			routeProps,
			registerRoute,
			unregisterRoute,
			activeRoute,
			route,
			$activeRoute
		});

		$$self.$inject_state = $$new_props => {
			$$invalidate(11, $$props = assign(assign({}, $$props), $$new_props));
			if ('path' in $$props) $$invalidate(6, path = $$new_props.path);
			if ('component' in $$props) $$invalidate(0, component = $$new_props.component);
			if ('routeParams' in $$props) $$invalidate(2, routeParams = $$new_props.routeParams);
			if ('routeProps' in $$props) $$invalidate(3, routeProps = $$new_props.routeProps);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$self.$$.update = () => {
			if ($activeRoute && $activeRoute.route === route) {
				$$invalidate(2, routeParams = $activeRoute.params);
				const { component: c, path, ...rest } = $$props;
				$$invalidate(3, routeProps = rest);

				if (c) {
					if (c.toString().startsWith("class ")) $$invalidate(0, component = c); else $$invalidate(0, component = c());
				}

				canUseDOM() && !$activeRoute.preserveScroll && window?.scrollTo(0, 0);
			}
		};

		$$props = exclude_internal_props($$props);

		return [
			component,
			$activeRoute,
			routeParams,
			routeProps,
			activeRoute,
			route,
			path,
			$$scope,
			slots
		];
	}

	class Route extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$7, create_fragment$7, safe_not_equal, { path: 6, component: 0 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Route",
				options,
				id: create_fragment$7.name
			});
		}

		get path() {
			throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set path(value) {
			throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get component() {
			throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set component(value) {
			throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const subscriber_queue = [];

	/**
	 * Creates a `Readable` store that allows reading by subscription.
	 *
	 * https://svelte.dev/docs/svelte-store#readable
	 * @template T
	 * @param {T} [value] initial value
	 * @param {import('./public.js').StartStopNotifier<T>} [start]
	 * @returns {import('./public.js').Readable<T>}
	 */
	function readable(value, start) {
		return {
			subscribe: writable(value, start).subscribe
		};
	}

	/**
	 * Create a `Writable` store that allows both updating and reading by subscription.
	 *
	 * https://svelte.dev/docs/svelte-store#writable
	 * @template T
	 * @param {T} [value] initial value
	 * @param {import('./public.js').StartStopNotifier<T>} [start]
	 * @returns {import('./public.js').Writable<T>}
	 */
	function writable(value, start = noop) {
		/** @type {import('./public.js').Unsubscriber} */
		let stop;
		/** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
		const subscribers = new Set();
		/** @param {T} new_value
		 * @returns {void}
		 */
		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (stop) {
					// store is ready
					const run_queue = !subscriber_queue.length;
					for (const subscriber of subscribers) {
						subscriber[1]();
						subscriber_queue.push(subscriber, value);
					}
					if (run_queue) {
						for (let i = 0; i < subscriber_queue.length; i += 2) {
							subscriber_queue[i][0](subscriber_queue[i + 1]);
						}
						subscriber_queue.length = 0;
					}
				}
			}
		}

		/**
		 * @param {import('./public.js').Updater<T>} fn
		 * @returns {void}
		 */
		function update(fn) {
			set(fn(value));
		}

		/**
		 * @param {import('./public.js').Subscriber<T>} run
		 * @param {import('./private.js').Invalidator<T>} [invalidate]
		 * @returns {import('./public.js').Unsubscriber}
		 */
		function subscribe(run, invalidate = noop) {
			/** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
			const subscriber = [run, invalidate];
			subscribers.add(subscriber);
			if (subscribers.size === 1) {
				stop = start(set, update) || noop;
			}
			run(value);
			return () => {
				subscribers.delete(subscriber);
				if (subscribers.size === 0 && stop) {
					stop();
					stop = null;
				}
			};
		}
		return { set, update, subscribe };
	}

	/**
	 * Derived value store by synchronizing one or more readable stores and
	 * applying an aggregation function over its input values.
	 *
	 * https://svelte.dev/docs/svelte-store#derived
	 * @template {import('./private.js').Stores} S
	 * @template T
	 * @overload
	 * @param {S} stores - input stores
	 * @param {(values: import('./private.js').StoresValues<S>, set: (value: T) => void, update: (fn: import('./public.js').Updater<T>) => void) => import('./public.js').Unsubscriber | void} fn - function callback that aggregates the values
	 * @param {T} [initial_value] - initial value
	 * @returns {import('./public.js').Readable<T>}
	 */

	/**
	 * Derived value store by synchronizing one or more readable stores and
	 * applying an aggregation function over its input values.
	 *
	 * https://svelte.dev/docs/svelte-store#derived
	 * @template {import('./private.js').Stores} S
	 * @template T
	 * @overload
	 * @param {S} stores - input stores
	 * @param {(values: import('./private.js').StoresValues<S>) => T} fn - function callback that aggregates the values
	 * @param {T} [initial_value] - initial value
	 * @returns {import('./public.js').Readable<T>}
	 */

	/**
	 * @template {import('./private.js').Stores} S
	 * @template T
	 * @param {S} stores
	 * @param {Function} fn
	 * @param {T} [initial_value]
	 * @returns {import('./public.js').Readable<T>}
	 */
	function derived(stores, fn, initial_value) {
		const single = !Array.isArray(stores);
		/** @type {Array<import('./public.js').Readable<any>>} */
		const stores_array = single ? [stores] : stores;
		if (!stores_array.every(Boolean)) {
			throw new Error('derived() expects stores as input, got a falsy value');
		}
		const auto = fn.length < 2;
		return readable(initial_value, (set, update) => {
			let started = false;
			const values = [];
			let pending = 0;
			let cleanup = noop;
			const sync = () => {
				if (pending) {
					return;
				}
				cleanup();
				const result = fn(single ? values[0] : values, set, update);
				if (auto) {
					set(result);
				} else {
					cleanup = is_function(result) ? result : noop;
				}
			};
			const unsubscribers = stores_array.map((store, i) =>
				subscribe(
					store,
					(value) => {
						values[i] = value;
						pending &= ~(1 << i);
						if (started) {
							sync();
						}
					},
					() => {
						pending |= 1 << i;
					}
				)
			);
			started = true;
			sync();
			return function stop() {
				run_all(unsubscribers);
				cleanup();
				// We need to set this to false because callbacks can still happen despite having unsubscribed:
				// Callbacks might already be placed in the queue which doesn't know it should no longer
				// invoke this derived store.
				started = false;
			};
		});
	}

	/**
	 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
	 * https://github.com/reach/router/blob/master/LICENSE
	 */

	const getLocation = (source) => {
	    return {
	        ...source.location,
	        state: source.history.state,
	        key: (source.history.state && source.history.state.key) || "initial",
	    };
	};
	const createHistory = (source) => {
	    const listeners = [];
	    let location = getLocation(source);

	    return {
	        get location() {
	            return location;
	        },

	        listen(listener) {
	            listeners.push(listener);

	            const popstateListener = () => {
	                location = getLocation(source);
	                listener({ location, action: "POP" });
	            };

	            source.addEventListener("popstate", popstateListener);

	            return () => {
	                source.removeEventListener("popstate", popstateListener);
	                const index = listeners.indexOf(listener);
	                listeners.splice(index, 1);
	            };
	        },

	        navigate(to, { state, replace = false, preserveScroll = false, blurActiveElement = true } = {}) {
	            state = { ...state, key: Date.now() + "" };
	            // try...catch iOS Safari limits to 100 pushState calls
	            try {
	                if (replace) source.history.replaceState(state, "", to);
	                else source.history.pushState(state, "", to);
	            } catch (e) {
	                source.location[replace ? "replace" : "assign"](to);
	            }
	            location = getLocation(source);
	            listeners.forEach((listener) =>
	                listener({ location, action: "PUSH", preserveScroll })
	            );
	            if(blurActiveElement) document.activeElement.blur();
	        },
	    };
	};
	// Stores history entries in memory for testing or other platforms like Native
	const createMemorySource = (initialPathname = "/") => {
	    let index = 0;
	    const stack = [{ pathname: initialPathname, search: "" }];
	    const states = [];

	    return {
	        get location() {
	            return stack[index];
	        },
	        addEventListener(name, fn) {},
	        removeEventListener(name, fn) {},
	        history: {
	            get entries() {
	                return stack;
	            },
	            get index() {
	                return index;
	            },
	            get state() {
	                return states[index];
	            },
	            pushState(state, _, uri) {
	                const [pathname, search = ""] = uri.split("?");
	                index++;
	                stack.push({ pathname, search });
	                states.push(state);
	            },
	            replaceState(state, _, uri) {
	                const [pathname, search = ""] = uri.split("?");
	                stack[index] = { pathname, search };
	                states[index] = state;
	            },
	        },
	    };
	};
	// Global history uses window.history as the source if available,
	// otherwise a memory history
	const globalHistory = createHistory(
	    canUseDOM() ? window : createMemorySource()
	);
	const { navigate } = globalHistory;

	/* node_modules/svelte-routing/src/Router.svelte generated by Svelte v4.2.19 */

	const { Object: Object_1$1 } = globals;
	const file$6 = "node_modules/svelte-routing/src/Router.svelte";

	const get_default_slot_changes_1 = dirty => ({
		route: dirty & /*$activeRoute*/ 4,
		location: dirty & /*$location*/ 2
	});

	const get_default_slot_context_1 = ctx => ({
		route: /*$activeRoute*/ ctx[2] && /*$activeRoute*/ ctx[2].uri,
		location: /*$location*/ ctx[1]
	});

	const get_default_slot_changes = dirty => ({
		route: dirty & /*$activeRoute*/ 4,
		location: dirty & /*$location*/ 2
	});

	const get_default_slot_context = ctx => ({
		route: /*$activeRoute*/ ctx[2] && /*$activeRoute*/ ctx[2].uri,
		location: /*$location*/ ctx[1]
	});

	// (143:0) {:else}
	function create_else_block$3(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[15].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[14], get_default_slot_context_1);

		const block = {
			c: function create() {
				if (default_slot) default_slot.c();
			},
			m: function mount(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p: function update(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope, $activeRoute, $location*/ 16390)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[14],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[14])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[14], dirty, get_default_slot_changes_1),
							get_default_slot_context_1
						);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$3.name,
			type: "else",
			source: "(143:0) {:else}",
			ctx
		});

		return block;
	}

	// (134:0) {#if viewtransition}
	function create_if_block$4(ctx) {
		let previous_key = /*$location*/ ctx[1].pathname;
		let key_block_anchor;
		let current;
		let key_block = create_key_block(ctx);

		const block = {
			c: function create() {
				key_block.c();
				key_block_anchor = empty();
			},
			m: function mount(target, anchor) {
				key_block.m(target, anchor);
				insert_dev(target, key_block_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (dirty & /*$location*/ 2 && safe_not_equal(previous_key, previous_key = /*$location*/ ctx[1].pathname)) {
					group_outros();
					transition_out(key_block, 1, 1, noop);
					check_outros();
					key_block = create_key_block(ctx);
					key_block.c();
					transition_in(key_block, 1);
					key_block.m(key_block_anchor.parentNode, key_block_anchor);
				} else {
					key_block.p(ctx, dirty);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(key_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(key_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(key_block_anchor);
				}

				key_block.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$4.name,
			type: "if",
			source: "(134:0) {#if viewtransition}",
			ctx
		});

		return block;
	}

	// (135:4) {#key $location.pathname}
	function create_key_block(ctx) {
		let div;
		let div_intro;
		let div_outro;
		let current;
		const default_slot_template = /*#slots*/ ctx[15].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[14], get_default_slot_context);

		const block = {
			c: function create() {
				div = element("div");
				if (default_slot) default_slot.c();
				add_location(div, file$6, 135, 8, 4659);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);

				if (default_slot) {
					default_slot.m(div, null);
				}

				current = true;
			},
			p: function update(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope, $activeRoute, $location*/ 16390)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[14],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[14])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[14], dirty, get_default_slot_changes),
							get_default_slot_context
						);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);

				if (local) {
					add_render_callback(() => {
						if (!current) return;
						if (div_outro) div_outro.end(1);
						div_intro = create_in_transition(div, /*viewtransitionFn*/ ctx[3], {});
						div_intro.start();
					});
				}

				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				if (div_intro) div_intro.invalidate();

				if (local) {
					div_outro = create_out_transition(div, /*viewtransitionFn*/ ctx[3], {});
				}

				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				if (default_slot) default_slot.d(detaching);
				if (detaching && div_outro) div_outro.end();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_key_block.name,
			type: "key",
			source: "(135:4) {#key $location.pathname}",
			ctx
		});

		return block;
	}

	function create_fragment$6(ctx) {
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block$4, create_else_block$3];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*viewtransition*/ ctx[0]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				if_block.c();
				if_block_anchor = empty();
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert_dev(target, if_block_anchor, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$6.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$6($$self, $$props, $$invalidate) {
		let $location;
		let $routes;
		let $base;
		let $activeRoute;
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Router', slots, ['default']);
		let { basepath = "/" } = $$props;
		let { url = null } = $$props;
		let { viewtransition = null } = $$props;
		let { history = globalHistory } = $$props;

		const viewtransitionFn = (node, _, direction) => {
			const vt = viewtransition(direction);
			if (typeof vt?.fn === "function") return vt.fn(node, vt); else return vt;
		};

		setContext(HISTORY, history);
		const locationContext = getContext(LOCATION);
		const routerContext = getContext(ROUTER);
		const routes = writable([]);
		validate_store(routes, 'routes');
		component_subscribe($$self, routes, value => $$invalidate(12, $routes = value));
		const activeRoute = writable(null);
		validate_store(activeRoute, 'activeRoute');
		component_subscribe($$self, activeRoute, value => $$invalidate(2, $activeRoute = value));
		let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

		// If locationContext is not set, this is the topmost Router in the tree.
		// If the `url` prop is given we force the location to it.
		const location = locationContext || writable(url ? { pathname: url } : history.location);

		validate_store(location, 'location');
		component_subscribe($$self, location, value => $$invalidate(1, $location = value));

		// If routerContext is set, the routerBase of the parent Router
		// will be the base for this Router's descendants.
		// If routerContext is not set, the path and resolved uri will both
		// have the value of the basepath prop.
		const base = routerContext
		? routerContext.routerBase
		: writable({ path: basepath, uri: basepath });

		validate_store(base, 'base');
		component_subscribe($$self, base, value => $$invalidate(13, $base = value));

		const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
			// If there is no activeRoute, the routerBase will be identical to the base.
			if (!activeRoute) return base;

			const { path: basepath } = base;
			const { route, uri } = activeRoute;

			// Remove the potential /* or /*splatname from
			// the end of the child Routes relative paths.
			const path = route.default
			? basepath
			: route.path.replace(/\*.*$/, "");

			return { path, uri };
		});

		const registerRoute = route => {
			const { path: basepath } = $base;
			let { path } = route;

			// We store the original path in the _path property so we can reuse
			// it when the basepath changes. The only thing that matters is that
			// the route reference is intact, so mutation is fine.
			route._path = path;

			route.path = combinePaths(basepath, path);

			if (typeof window === "undefined") {
				// In SSR we should set the activeRoute immediately if it is a match.
				// If there are more Routes being registered after a match is found,
				// we just skip them.
				if (hasActiveRoute) return;

				const matchingRoute = pick([route], $location.pathname);

				if (matchingRoute) {
					activeRoute.set(matchingRoute);
					hasActiveRoute = true;
				}
			} else {
				routes.update(rs => [...rs, route]);
			}
		};

		const unregisterRoute = route => {
			routes.update(rs => rs.filter(r => r !== route));
		};

		let preserveScroll = false;

		if (!locationContext) {
			// The topmost Router in the tree is responsible for updating
			// the location store and supplying it through context.
			onMount(() => {
				const unlisten = history.listen(event => {
					$$invalidate(11, preserveScroll = event.preserveScroll || false);
					location.set(event.location);
				});

				return unlisten;
			});

			setContext(LOCATION, location);
		}

		setContext(ROUTER, {
			activeRoute,
			base,
			routerBase,
			registerRoute,
			unregisterRoute
		});

		const writable_props = ['basepath', 'url', 'viewtransition', 'history'];

		Object_1$1.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('basepath' in $$props) $$invalidate(8, basepath = $$props.basepath);
			if ('url' in $$props) $$invalidate(9, url = $$props.url);
			if ('viewtransition' in $$props) $$invalidate(0, viewtransition = $$props.viewtransition);
			if ('history' in $$props) $$invalidate(10, history = $$props.history);
			if ('$$scope' in $$props) $$invalidate(14, $$scope = $$props.$$scope);
		};

		$$self.$capture_state = () => ({
			getContext,
			onMount,
			setContext,
			derived,
			writable,
			HISTORY,
			LOCATION,
			ROUTER,
			globalHistory,
			combinePaths,
			pick,
			basepath,
			url,
			viewtransition,
			history,
			viewtransitionFn,
			locationContext,
			routerContext,
			routes,
			activeRoute,
			hasActiveRoute,
			location,
			base,
			routerBase,
			registerRoute,
			unregisterRoute,
			preserveScroll,
			$location,
			$routes,
			$base,
			$activeRoute
		});

		$$self.$inject_state = $$props => {
			if ('basepath' in $$props) $$invalidate(8, basepath = $$props.basepath);
			if ('url' in $$props) $$invalidate(9, url = $$props.url);
			if ('viewtransition' in $$props) $$invalidate(0, viewtransition = $$props.viewtransition);
			if ('history' in $$props) $$invalidate(10, history = $$props.history);
			if ('hasActiveRoute' in $$props) hasActiveRoute = $$props.hasActiveRoute;
			if ('preserveScroll' in $$props) $$invalidate(11, preserveScroll = $$props.preserveScroll);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*$base*/ 8192) {
				// This reactive statement will update all the Routes' path when
				// the basepath changes.
				{
					const { path: basepath } = $base;
					routes.update(rs => rs.map(r => Object.assign(r, { path: combinePaths(basepath, r._path) })));
				}
			}

			if ($$self.$$.dirty & /*$routes, $location, preserveScroll*/ 6146) {
				// This reactive statement will be run when the Router is created
				// when there are no Routes and then again the following tick, so it
				// will not find an active Route in SSR and in the browser it will only
				// pick an active Route after all Routes have been registered.
				{
					const bestMatch = pick($routes, $location.pathname);
					activeRoute.set(bestMatch ? { ...bestMatch, preserveScroll } : bestMatch);
				}
			}
		};

		return [
			viewtransition,
			$location,
			$activeRoute,
			viewtransitionFn,
			routes,
			activeRoute,
			location,
			base,
			basepath,
			url,
			history,
			preserveScroll,
			$routes,
			$base,
			$$scope,
			slots
		];
	}

	class Router extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$6, create_fragment$6, safe_not_equal, {
				basepath: 8,
				url: 9,
				viewtransition: 0,
				history: 10
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Router",
				options,
				id: create_fragment$6.name
			});
		}

		get basepath() {
			throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set basepath(value) {
			throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get url() {
			throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set url(value) {
			throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get viewtransition() {
			throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set viewtransition(value) {
			throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get history() {
			throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set history(value) {
			throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/components/routes/Navbar.svelte generated by Svelte v4.2.19 */
	const file$5 = "src/components/routes/Navbar.svelte";

	// (34:12) {:else}
	function create_else_block$2(ctx) {
		let a;

		const block = {
			c: function create() {
				a = element("a");
				a.textContent = "Login";
				attr_dev(a, "href", "/login");
				attr_dev(a, "class", "nav-link text-white hover:text-gray-300 py-2 px-4 transition duration-200");
				add_location(a, file$5, 39, 16, 1479);
			},
			m: function mount(target, anchor) {
				insert_dev(target, a, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(a);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$2.name,
			type: "else",
			source: "(34:12) {:else}",
			ctx
		});

		return block;
	}

	// (32:12) {#if isAuthenticated}
	function create_if_block$3(ctx) {
		let button;
		let mounted;
		let dispose;

		const block = {
			c: function create() {
				button = element("button");
				button.textContent = "Logout";
				attr_dev(button, "class", "nav-button bg-gray-300 text-gray-900 py-2 px-4 rounded transition duration-200 hover:bg-gray-400");
				add_location(button, file$5, 37, 16, 1296);
			},
			m: function mount(target, anchor) {
				insert_dev(target, button, anchor);

				if (!mounted) {
					dispose = listen_dev(button, "click", /*logout*/ ctx[1], false, false, false, false);
					mounted = true;
				}
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(button);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$3.name,
			type: "if",
			source: "(32:12) {#if isAuthenticated}",
			ctx
		});

		return block;
	}

	function create_fragment$5(ctx) {
		let nav;
		let div2;
		let div0;
		let t1;
		let div1;
		let a0;
		let t3;
		let a1;
		let t5;

		function select_block_type(ctx, dirty) {
			if (/*isAuthenticated*/ ctx[0]) return create_if_block$3;
			return create_else_block$2;
		}

		let current_block_type = select_block_type(ctx);
		let if_block = current_block_type(ctx);

		const block = {
			c: function create() {
				nav = element("nav");
				div2 = element("div");
				div0 = element("div");
				div0.textContent = "API Routes";
				t1 = space();
				div1 = element("div");
				a0 = element("a");
				a0.textContent = "Home";
				t3 = space();
				a1 = element("a");
				a1.textContent = "Contato";
				t5 = space();
				if_block.c();
				attr_dev(div0, "class", "title text-gray-300 text-2xl");
				add_location(div0, file$5, 32, 8, 886);
				attr_dev(a0, "href", "/");
				attr_dev(a0, "class", "nav-link text-white hover:text-gray-300 mr-6 py-2 px-4 transition duration-200");
				add_location(a0, file$5, 34, 12, 1007);
				attr_dev(a1, "href", "/contatos");
				attr_dev(a1, "class", "nav-link text-white hover:text-gray-300 mr-6 py-2 px-4 transition duration-200");
				add_location(a1, file$5, 35, 12, 1127);
				attr_dev(div1, "class", "nav-links flex items-center");
				add_location(div1, file$5, 33, 8, 953);
				attr_dev(div2, "class", "container mx-auto flex justify-between items-center px-4 py-2");
				add_location(div2, file$5, 31, 4, 802);
				attr_dev(nav, "class", "navbar fixed top-0 left-0 w-full z-50 transition-all duration-300");
				add_location(nav, file$5, 30, 0, 718);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, nav, anchor);
				append_dev(nav, div2);
				append_dev(div2, div0);
				append_dev(div2, t1);
				append_dev(div2, div1);
				append_dev(div1, a0);
				append_dev(div1, t3);
				append_dev(div1, a1);
				append_dev(div1, t5);
				if_block.m(div1, null);
			},
			p: function update(ctx, [dirty]) {
				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block.d(1);
					if_block = current_block_type(ctx);

					if (if_block) {
						if_block.c();
						if_block.m(div1, null);
					}
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(nav);
				}

				if_block.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$5.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function handleScroll() {
		const navbar = document.querySelector('.navbar');

		if (window.scrollY > 0) {
			navbar.classList.add('bg-gray-900', 'bg-opacity-90');
		} else {
			navbar.classList.remove('bg-gray-900', 'bg-opacity-90');
		}
	}

	function instance$5($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Navbar', slots, []);
		let isAuthenticated = false;

		onMount(() => {
			const apiKey = localStorage.getItem('apiKey');
			$$invalidate(0, isAuthenticated = !!apiKey);

			// Adiciona um listener para rolagem da página
			window.addEventListener('scroll', handleScroll);
		});

		function logout() {
			localStorage.removeItem('apiKey');
			$$invalidate(0, isAuthenticated = false);
			navigate('/login');
		}

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Navbar> was created with unknown prop '${key}'`);
		});

		$$self.$capture_state = () => ({
			onMount,
			navigate,
			isAuthenticated,
			handleScroll,
			logout
		});

		$$self.$inject_state = $$props => {
			if ('isAuthenticated' in $$props) $$invalidate(0, isAuthenticated = $$props.isAuthenticated);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [isAuthenticated, logout];
	}

	class Navbar extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Navbar",
				options,
				id: create_fragment$5.name
			});
		}
	}

	/* src/components/routes/Home.svelte generated by Svelte v4.2.19 */

	const { Error: Error_1$1, console: console_1$4 } = globals;
	const file$4 = "src/components/routes/Home.svelte";

	function get_each_context$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[12] = list[i];
		child_ctx[14] = i;
		return child_ctx;
	}

	function get_each_context_1$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[15] = list[i];
		return child_ctx;
	}

	// (77:4) {#if errorMessage}
	function create_if_block_1$1(ctx) {
		let p;
		let t;

		const block = {
			c: function create() {
				p = element("p");
				t = text(/*errorMessage*/ ctx[3]);
				attr_dev(p, "class", "text-red-500 mb-4");
				add_location(p, file$4, 78, 8, 2906);
			},
			m: function mount(target, anchor) {
				insert_dev(target, p, anchor);
				append_dev(p, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*errorMessage*/ 8) set_data_dev(t, /*errorMessage*/ ctx[3]);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(p);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$1.name,
			type: "if",
			source: "(77:4) {#if errorMessage}",
			ctx
		});

		return block;
	}

	// (83:4) {:else}
	function create_else_block$1(ctx) {
		let ul;
		let t;
		let div;
		let each_value_1 = ensure_array_like_dev(/*currentContacts*/ ctx[5]());
		let each_blocks_1 = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
		}

		let each_value = ensure_array_like_dev(Array(Math.ceil(/*totalContacts*/ ctx[2] / contactsPerPage$1)));
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
		}

		const block = {
			c: function create() {
				ul = element("ul");

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t = space();
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(ul, "class", "list-none p-0 m-0 space-y-2");
				add_location(ul, file$4, 84, 8, 3085);
				attr_dev(div, "class", "mt-4 flex justify-center space-x-2");
				add_location(div, file$4, 99, 8, 3792);
			},
			m: function mount(target, anchor) {
				insert_dev(target, ul, anchor);

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(ul, null);
					}
				}

				insert_dev(target, t, anchor);
				insert_dev(target, div, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div, null);
					}
				}
			},
			p: function update(ctx, dirty) {
				if (dirty & /*goToConversation, currentContacts*/ 48) {
					each_value_1 = ensure_array_like_dev(/*currentContacts*/ ctx[5]());
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
						} else {
							each_blocks_1[i] = create_each_block_1$1(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].m(ul, null);
						}
					}

					for (; i < each_blocks_1.length; i += 1) {
						each_blocks_1[i].d(1);
					}

					each_blocks_1.length = each_value_1.length;
				}

				if (dirty & /*currentPage, changePage, totalContacts*/ 70) {
					each_value = ensure_array_like_dev(Array(Math.ceil(/*totalContacts*/ ctx[2] / contactsPerPage$1)));
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$2(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$2(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(ul);
					detach_dev(t);
					detach_dev(div);
				}

				destroy_each(each_blocks_1, detaching);
				destroy_each(each_blocks, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$1.name,
			type: "else",
			source: "(83:4) {:else}",
			ctx
		});

		return block;
	}

	// (81:4) {#if contacts.length === 0}
	function create_if_block$2(ctx) {
		let p;

		const block = {
			c: function create() {
				p = element("p");
				p.textContent = "Nenhum contato encontrado.";
				attr_dev(p, "class", "text-gray-500");
				add_location(p, file$4, 82, 8, 3009);
			},
			m: function mount(target, anchor) {
				insert_dev(target, p, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(p);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$2.name,
			type: "if",
			source: "(81:4) {#if contacts.length === 0}",
			ctx
		});

		return block;
	}

	// (85:12) {#each currentContacts() as contact}
	function create_each_block_1$1(ctx) {
		let li;
		let button;
		let i;
		let t0;
		let span;
		let t2;
		let mounted;
		let dispose;

		function click_handler() {
			return /*click_handler*/ ctx[7](/*contact*/ ctx[15]);
		}

		const block = {
			c: function create() {
				li = element("li");
				button = element("button");
				i = element("i");
				t0 = space();
				span = element("span");
				span.textContent = `${/*contact*/ ctx[15].name}`;
				t2 = space();
				attr_dev(i, "class", "fas fa-user-circle text-xl mr-3");
				add_location(i, file$4, 92, 24, 3579);
				attr_dev(span, "class", "text-left");
				add_location(span, file$4, 93, 24, 3651);
				attr_dev(button, "type", "button");
				attr_dev(button, "class", "flex items-center justify-start w-full py-3 px-4 bg-gray-100 rounded-lg transition duration-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500");
				add_location(button, file$4, 87, 20, 3216);
				add_location(li, file$4, 86, 16, 3191);
			},
			m: function mount(target, anchor) {
				insert_dev(target, li, anchor);
				append_dev(li, button);
				append_dev(button, i);
				append_dev(button, t0);
				append_dev(button, span);
				append_dev(li, t2);

				if (!mounted) {
					dispose = listen_dev(button, "click", click_handler, false, false, false, false);
					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(li);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block_1$1.name,
			type: "each",
			source: "(85:12) {#each currentContacts() as contact}",
			ctx
		});

		return block;
	}

	// (100:12) {#each Array(Math.ceil(totalContacts / contactsPerPage)) as _, index}
	function create_each_block$2(ctx) {
		let button;
		let t0_value = /*index*/ ctx[14] + 1 + "";
		let t0;
		let t1;
		let button_disabled_value;
		let mounted;
		let dispose;

		function click_handler_1() {
			return /*click_handler_1*/ ctx[8](/*index*/ ctx[14]);
		}

		const block = {
			c: function create() {
				button = element("button");
				t0 = text(t0_value);
				t1 = space();
				button.disabled = button_disabled_value = /*currentPage*/ ctx[1] === /*index*/ ctx[14] + 1;
				attr_dev(button, "class", "px-4 py-2 rounded-lg bg-blue-500 text-white transition duration-300 disabled:bg-gray-300 hover:bg-blue-600");
				add_location(button, file$4, 101, 16, 3939);
			},
			m: function mount(target, anchor) {
				insert_dev(target, button, anchor);
				append_dev(button, t0);
				append_dev(button, t1);

				if (!mounted) {
					dispose = listen_dev(button, "click", click_handler_1, false, false, false, false);
					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;

				if (dirty & /*currentPage*/ 2 && button_disabled_value !== (button_disabled_value = /*currentPage*/ ctx[1] === /*index*/ ctx[14] + 1)) {
					prop_dev(button, "disabled", button_disabled_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(button);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block$2.name,
			type: "each",
			source: "(100:12) {#each Array(Math.ceil(totalContacts / contactsPerPage)) as _, index}",
			ctx
		});

		return block;
	}

	function create_fragment$4(ctx) {
		let div;
		let h1;
		let t1;
		let t2;
		let if_block0 = /*errorMessage*/ ctx[3] && create_if_block_1$1(ctx);

		function select_block_type(ctx, dirty) {
			if (/*contacts*/ ctx[0].length === 0) return create_if_block$2;
			return create_else_block$1;
		}

		let current_block_type = select_block_type(ctx);
		let if_block1 = current_block_type(ctx);

		const block = {
			c: function create() {
				div = element("div");
				h1 = element("h1");
				h1.textContent = "Lista de Contatos";
				t1 = space();
				if (if_block0) if_block0.c();
				t2 = space();
				if_block1.c();
				attr_dev(h1, "class", "text-4xl mb-6 font-semibold text-gray-800");
				add_location(h1, file$4, 75, 4, 2793);
				attr_dev(div, "class", "max-w-md mx-auto my-12 p-8 bg-white rounded-lg shadow-lg text-center");
				add_location(div, file$4, 74, 0, 2706);
			},
			l: function claim(nodes) {
				throw new Error_1$1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, h1);
				append_dev(div, t1);
				if (if_block0) if_block0.m(div, null);
				append_dev(div, t2);
				if_block1.m(div, null);
			},
			p: function update(ctx, [dirty]) {
				if (/*errorMessage*/ ctx[3]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_1$1(ctx);
						if_block0.c();
						if_block0.m(div, t2);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1.d(1);
					if_block1 = current_block_type(ctx);

					if (if_block1) {
						if_block1.c();
						if_block1.m(div, null);
					}
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				if (if_block0) if_block0.d();
				if_block1.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$4.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	const contactsPerPage$1 = 10;

	function instance$4($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Home', slots, []);

		var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
			function adopt(value) {
				return value instanceof P
				? value
				: new P(function (resolve) {
							resolve(value);
						});
			}

			return new (P || (P = Promise))(function (resolve, reject) {
					function fulfilled(value) {
						try {
							step(generator.next(value));
						} catch(e) {
							reject(e);
						}
					}

					function rejected(value) {
						try {
							step(generator["throw"](value));
						} catch(e) {
							reject(e);
						}
					}

					function step(result) {
						result.done
						? resolve(result.value)
						: adopt(result.value).then(fulfilled, rejected);
					}

					step((generator = generator.apply(thisArg, _arguments || [])).next());
				});
		};

		let contacts = [];
		let currentPage = 1;
		let totalContacts = 0;
		const apiKey = localStorage.getItem('apiKey');
		let errorMessage = '';

		function fetchContacts() {
			return __awaiter(this, void 0, void 0, function* () {
				try {
					console.log('Fetching contacts...');

					const response = yield fetch('http://localhost:3000/api/contacts', {
						method: 'GET',
						headers: {
							'Authorization': `Bearer ${apiKey}`,
							'Content-Type': 'application/json'
						}
					});

					if (!response.ok) {
						if (response.status === 401) {
							$$invalidate(3, errorMessage = 'Unauthorized access. Please log in again.');
						} else if (response.status === 404) {
							$$invalidate(3, errorMessage = 'Contacts not found.');
						} else {
							$$invalidate(3, errorMessage = 'Error fetching contacts. Please try again later.');
						}

						throw new Error('Failed to fetch contacts');
					}

					const data = yield response.json();
					$$invalidate(0, contacts = data.contacts || []);
					$$invalidate(2, totalContacts = contacts.length);
				} catch(error) {
					console.error('Error:', error);
					$$invalidate(3, errorMessage = 'Erro ao buscar contatos. Redirecionando para login...');

					setTimeout(
						() => {
							navigate('/login');
						},
						3000
					);
				}
			});
		}

		function goToConversation(contactId) {
			navigate(`/contato/${contactId}`);
		}

		function currentContacts() {
			const startIndex = (currentPage - 1) * contactsPerPage$1;
			return contacts.slice(startIndex, startIndex + contactsPerPage$1);
		}

		function changePage(page) {
			$$invalidate(1, currentPage = page);
		}

		onMount(() => {
			if (!apiKey) {
				navigate('/login');
			} else {
				fetchContacts();
			}
		});

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$4.warn(`<Home> was created with unknown prop '${key}'`);
		});

		const click_handler = contact => goToConversation(contact.id);
		const click_handler_1 = index => changePage(index + 1);

		$$self.$capture_state = () => ({
			__awaiter,
			onMount,
			navigate,
			contacts,
			currentPage,
			contactsPerPage: contactsPerPage$1,
			totalContacts,
			apiKey,
			errorMessage,
			fetchContacts,
			goToConversation,
			currentContacts,
			changePage
		});

		$$self.$inject_state = $$props => {
			if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
			if ('contacts' in $$props) $$invalidate(0, contacts = $$props.contacts);
			if ('currentPage' in $$props) $$invalidate(1, currentPage = $$props.currentPage);
			if ('totalContacts' in $$props) $$invalidate(2, totalContacts = $$props.totalContacts);
			if ('errorMessage' in $$props) $$invalidate(3, errorMessage = $$props.errorMessage);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [
			contacts,
			currentPage,
			totalContacts,
			errorMessage,
			goToConversation,
			currentContacts,
			changePage,
			click_handler,
			click_handler_1
		];
	}

	class Home extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Home",
				options,
				id: create_fragment$4.name
			});
		}
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * @fileoverview Firebase constants.  Some of these (@defines) can be overridden at compile-time.
	 */
	const CONSTANTS = {
	    /**
	     * @define {boolean} Whether this is the client Node.js SDK.
	     */
	    NODE_CLIENT: false,
	    /**
	     * @define {boolean} Whether this is the Admin Node.js SDK.
	     */
	    NODE_ADMIN: false,
	    /**
	     * Firebase SDK Version
	     */
	    SDK_VERSION: '${JSCORE_VERSION}'
	};

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Throws an error if the provided assertion is falsy
	 */
	const assert = function (assertion, message) {
	    if (!assertion) {
	        throw assertionError(message);
	    }
	};
	/**
	 * Returns an Error object suitable for throwing.
	 */
	const assertionError = function (message) {
	    return new Error('Firebase Database (' +
	        CONSTANTS.SDK_VERSION +
	        ') INTERNAL ASSERT FAILED: ' +
	        message);
	};

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const stringToByteArray$1 = function (str) {
	    // TODO(user): Use native implementations if/when available
	    const out = [];
	    let p = 0;
	    for (let i = 0; i < str.length; i++) {
	        let c = str.charCodeAt(i);
	        if (c < 128) {
	            out[p++] = c;
	        }
	        else if (c < 2048) {
	            out[p++] = (c >> 6) | 192;
	            out[p++] = (c & 63) | 128;
	        }
	        else if ((c & 0xfc00) === 0xd800 &&
	            i + 1 < str.length &&
	            (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
	            // Surrogate Pair
	            c = 0x10000 + ((c & 0x03ff) << 10) + (str.charCodeAt(++i) & 0x03ff);
	            out[p++] = (c >> 18) | 240;
	            out[p++] = ((c >> 12) & 63) | 128;
	            out[p++] = ((c >> 6) & 63) | 128;
	            out[p++] = (c & 63) | 128;
	        }
	        else {
	            out[p++] = (c >> 12) | 224;
	            out[p++] = ((c >> 6) & 63) | 128;
	            out[p++] = (c & 63) | 128;
	        }
	    }
	    return out;
	};
	/**
	 * Turns an array of numbers into the string given by the concatenation of the
	 * characters to which the numbers correspond.
	 * @param bytes Array of numbers representing characters.
	 * @return Stringification of the array.
	 */
	const byteArrayToString = function (bytes) {
	    // TODO(user): Use native implementations if/when available
	    const out = [];
	    let pos = 0, c = 0;
	    while (pos < bytes.length) {
	        const c1 = bytes[pos++];
	        if (c1 < 128) {
	            out[c++] = String.fromCharCode(c1);
	        }
	        else if (c1 > 191 && c1 < 224) {
	            const c2 = bytes[pos++];
	            out[c++] = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
	        }
	        else if (c1 > 239 && c1 < 365) {
	            // Surrogate Pair
	            const c2 = bytes[pos++];
	            const c3 = bytes[pos++];
	            const c4 = bytes[pos++];
	            const u = (((c1 & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) -
	                0x10000;
	            out[c++] = String.fromCharCode(0xd800 + (u >> 10));
	            out[c++] = String.fromCharCode(0xdc00 + (u & 1023));
	        }
	        else {
	            const c2 = bytes[pos++];
	            const c3 = bytes[pos++];
	            out[c++] = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
	        }
	    }
	    return out.join('');
	};
	// We define it as an object literal instead of a class because a class compiled down to es5 can't
	// be treeshaked. https://github.com/rollup/rollup/issues/1691
	// Static lookup maps, lazily populated by init_()
	const base64 = {
	    /**
	     * Maps bytes to characters.
	     */
	    byteToCharMap_: null,
	    /**
	     * Maps characters to bytes.
	     */
	    charToByteMap_: null,
	    /**
	     * Maps bytes to websafe characters.
	     * @private
	     */
	    byteToCharMapWebSafe_: null,
	    /**
	     * Maps websafe characters to bytes.
	     * @private
	     */
	    charToByteMapWebSafe_: null,
	    /**
	     * Our default alphabet, shared between
	     * ENCODED_VALS and ENCODED_VALS_WEBSAFE
	     */
	    ENCODED_VALS_BASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789',
	    /**
	     * Our default alphabet. Value 64 (=) is special; it means "nothing."
	     */
	    get ENCODED_VALS() {
	        return this.ENCODED_VALS_BASE + '+/=';
	    },
	    /**
	     * Our websafe alphabet.
	     */
	    get ENCODED_VALS_WEBSAFE() {
	        return this.ENCODED_VALS_BASE + '-_.';
	    },
	    /**
	     * Whether this browser supports the atob and btoa functions. This extension
	     * started at Mozilla but is now implemented by many browsers. We use the
	     * ASSUME_* variables to avoid pulling in the full useragent detection library
	     * but still allowing the standard per-browser compilations.
	     *
	     */
	    HAS_NATIVE_SUPPORT: typeof atob === 'function',
	    /**
	     * Base64-encode an array of bytes.
	     *
	     * @param input An array of bytes (numbers with
	     *     value in [0, 255]) to encode.
	     * @param webSafe Boolean indicating we should use the
	     *     alternative alphabet.
	     * @return The base64 encoded string.
	     */
	    encodeByteArray(input, webSafe) {
	        if (!Array.isArray(input)) {
	            throw Error('encodeByteArray takes an array as a parameter');
	        }
	        this.init_();
	        const byteToCharMap = webSafe
	            ? this.byteToCharMapWebSafe_
	            : this.byteToCharMap_;
	        const output = [];
	        for (let i = 0; i < input.length; i += 3) {
	            const byte1 = input[i];
	            const haveByte2 = i + 1 < input.length;
	            const byte2 = haveByte2 ? input[i + 1] : 0;
	            const haveByte3 = i + 2 < input.length;
	            const byte3 = haveByte3 ? input[i + 2] : 0;
	            const outByte1 = byte1 >> 2;
	            const outByte2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
	            let outByte3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
	            let outByte4 = byte3 & 0x3f;
	            if (!haveByte3) {
	                outByte4 = 64;
	                if (!haveByte2) {
	                    outByte3 = 64;
	                }
	            }
	            output.push(byteToCharMap[outByte1], byteToCharMap[outByte2], byteToCharMap[outByte3], byteToCharMap[outByte4]);
	        }
	        return output.join('');
	    },
	    /**
	     * Base64-encode a string.
	     *
	     * @param input A string to encode.
	     * @param webSafe If true, we should use the
	     *     alternative alphabet.
	     * @return The base64 encoded string.
	     */
	    encodeString(input, webSafe) {
	        // Shortcut for Mozilla browsers that implement
	        // a native base64 encoder in the form of "btoa/atob"
	        if (this.HAS_NATIVE_SUPPORT && !webSafe) {
	            return btoa(input);
	        }
	        return this.encodeByteArray(stringToByteArray$1(input), webSafe);
	    },
	    /**
	     * Base64-decode a string.
	     *
	     * @param input to decode.
	     * @param webSafe True if we should use the
	     *     alternative alphabet.
	     * @return string representing the decoded value.
	     */
	    decodeString(input, webSafe) {
	        // Shortcut for Mozilla browsers that implement
	        // a native base64 encoder in the form of "btoa/atob"
	        if (this.HAS_NATIVE_SUPPORT && !webSafe) {
	            return atob(input);
	        }
	        return byteArrayToString(this.decodeStringToByteArray(input, webSafe));
	    },
	    /**
	     * Base64-decode a string.
	     *
	     * In base-64 decoding, groups of four characters are converted into three
	     * bytes.  If the encoder did not apply padding, the input length may not
	     * be a multiple of 4.
	     *
	     * In this case, the last group will have fewer than 4 characters, and
	     * padding will be inferred.  If the group has one or two characters, it decodes
	     * to one byte.  If the group has three characters, it decodes to two bytes.
	     *
	     * @param input Input to decode.
	     * @param webSafe True if we should use the web-safe alphabet.
	     * @return bytes representing the decoded value.
	     */
	    decodeStringToByteArray(input, webSafe) {
	        this.init_();
	        const charToByteMap = webSafe
	            ? this.charToByteMapWebSafe_
	            : this.charToByteMap_;
	        const output = [];
	        for (let i = 0; i < input.length;) {
	            const byte1 = charToByteMap[input.charAt(i++)];
	            const haveByte2 = i < input.length;
	            const byte2 = haveByte2 ? charToByteMap[input.charAt(i)] : 0;
	            ++i;
	            const haveByte3 = i < input.length;
	            const byte3 = haveByte3 ? charToByteMap[input.charAt(i)] : 64;
	            ++i;
	            const haveByte4 = i < input.length;
	            const byte4 = haveByte4 ? charToByteMap[input.charAt(i)] : 64;
	            ++i;
	            if (byte1 == null || byte2 == null || byte3 == null || byte4 == null) {
	                throw new DecodeBase64StringError();
	            }
	            const outByte1 = (byte1 << 2) | (byte2 >> 4);
	            output.push(outByte1);
	            if (byte3 !== 64) {
	                const outByte2 = ((byte2 << 4) & 0xf0) | (byte3 >> 2);
	                output.push(outByte2);
	                if (byte4 !== 64) {
	                    const outByte3 = ((byte3 << 6) & 0xc0) | byte4;
	                    output.push(outByte3);
	                }
	            }
	        }
	        return output;
	    },
	    /**
	     * Lazy static initialization function. Called before
	     * accessing any of the static map variables.
	     * @private
	     */
	    init_() {
	        if (!this.byteToCharMap_) {
	            this.byteToCharMap_ = {};
	            this.charToByteMap_ = {};
	            this.byteToCharMapWebSafe_ = {};
	            this.charToByteMapWebSafe_ = {};
	            // We want quick mappings back and forth, so we precompute two maps.
	            for (let i = 0; i < this.ENCODED_VALS.length; i++) {
	                this.byteToCharMap_[i] = this.ENCODED_VALS.charAt(i);
	                this.charToByteMap_[this.byteToCharMap_[i]] = i;
	                this.byteToCharMapWebSafe_[i] = this.ENCODED_VALS_WEBSAFE.charAt(i);
	                this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[i]] = i;
	                // Be forgiving when decoding and correctly decode both encodings.
	                if (i >= this.ENCODED_VALS_BASE.length) {
	                    this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(i)] = i;
	                    this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(i)] = i;
	                }
	            }
	        }
	    }
	};
	/**
	 * An error encountered while decoding base64 string.
	 */
	class DecodeBase64StringError extends Error {
	    constructor() {
	        super(...arguments);
	        this.name = 'DecodeBase64StringError';
	    }
	}
	/**
	 * URL-safe base64 encoding
	 */
	const base64Encode = function (str) {
	    const utf8Bytes = stringToByteArray$1(str);
	    return base64.encodeByteArray(utf8Bytes, true);
	};
	/**
	 * URL-safe base64 encoding (without "." padding in the end).
	 * e.g. Used in JSON Web Token (JWT) parts.
	 */
	const base64urlEncodeWithoutPadding = function (str) {
	    // Use base64url encoding and remove padding in the end (dot characters).
	    return base64Encode(str).replace(/\./g, '');
	};
	/**
	 * URL-safe base64 decoding
	 *
	 * NOTE: DO NOT use the global atob() function - it does NOT support the
	 * base64Url variant encoding.
	 *
	 * @param str To be decoded
	 * @return Decoded result, if possible
	 */
	const base64Decode = function (str) {
	    try {
	        return base64.decodeString(str, true);
	    }
	    catch (e) {
	        console.error('base64Decode failed: ', e);
	    }
	    return null;
	};

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Do a deep-copy of basic JavaScript Objects or Arrays.
	 */
	function deepCopy(value) {
	    return deepExtend(undefined, value);
	}
	/**
	 * Copy properties from source to target (recursively allows extension
	 * of Objects and Arrays).  Scalar values in the target are over-written.
	 * If target is undefined, an object of the appropriate type will be created
	 * (and returned).
	 *
	 * We recursively copy all child properties of plain Objects in the source- so
	 * that namespace- like dictionaries are merged.
	 *
	 * Note that the target can be a function, in which case the properties in
	 * the source Object are copied onto it as static properties of the Function.
	 *
	 * Note: we don't merge __proto__ to prevent prototype pollution
	 */
	function deepExtend(target, source) {
	    if (!(source instanceof Object)) {
	        return source;
	    }
	    switch (source.constructor) {
	        case Date:
	            // Treat Dates like scalars; if the target date object had any child
	            // properties - they will be lost!
	            const dateValue = source;
	            return new Date(dateValue.getTime());
	        case Object:
	            if (target === undefined) {
	                target = {};
	            }
	            break;
	        case Array:
	            // Always copy the array source and overwrite the target.
	            target = [];
	            break;
	        default:
	            // Not a plain Object - treat it as a scalar.
	            return source;
	    }
	    for (const prop in source) {
	        // use isValidKey to guard against prototype pollution. See https://snyk.io/vuln/SNYK-JS-LODASH-450202
	        if (!source.hasOwnProperty(prop) || !isValidKey$1(prop)) {
	            continue;
	        }
	        target[prop] = deepExtend(target[prop], source[prop]);
	    }
	    return target;
	}
	function isValidKey$1(key) {
	    return key !== '__proto__';
	}

	/**
	 * @license
	 * Copyright 2022 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Polyfill for `globalThis` object.
	 * @returns the `globalThis` object for the given environment.
	 * @public
	 */
	function getGlobal() {
	    if (typeof self !== 'undefined') {
	        return self;
	    }
	    if (typeof window !== 'undefined') {
	        return window;
	    }
	    if (typeof global !== 'undefined') {
	        return global;
	    }
	    throw new Error('Unable to locate global object.');
	}

	/**
	 * @license
	 * Copyright 2022 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const getDefaultsFromGlobal = () => getGlobal().__FIREBASE_DEFAULTS__;
	/**
	 * Attempt to read defaults from a JSON string provided to
	 * process(.)env(.)__FIREBASE_DEFAULTS__ or a JSON file whose path is in
	 * process(.)env(.)__FIREBASE_DEFAULTS_PATH__
	 * The dots are in parens because certain compilers (Vite?) cannot
	 * handle seeing that variable in comments.
	 * See https://github.com/firebase/firebase-js-sdk/issues/6838
	 */
	const getDefaultsFromEnvVariable = () => {
	    if (typeof process === 'undefined' || typeof process.env === 'undefined') {
	        return;
	    }
	    const defaultsJsonString = process.env.__FIREBASE_DEFAULTS__;
	    if (defaultsJsonString) {
	        return JSON.parse(defaultsJsonString);
	    }
	};
	const getDefaultsFromCookie = () => {
	    if (typeof document === 'undefined') {
	        return;
	    }
	    let match;
	    try {
	        match = document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/);
	    }
	    catch (e) {
	        // Some environments such as Angular Universal SSR have a
	        // `document` object but error on accessing `document.cookie`.
	        return;
	    }
	    const decoded = match && base64Decode(match[1]);
	    return decoded && JSON.parse(decoded);
	};
	/**
	 * Get the __FIREBASE_DEFAULTS__ object. It checks in order:
	 * (1) if such an object exists as a property of `globalThis`
	 * (2) if such an object was provided on a shell environment variable
	 * (3) if such an object exists in a cookie
	 * @public
	 */
	const getDefaults = () => {
	    try {
	        return (getDefaultsFromGlobal() ||
	            getDefaultsFromEnvVariable() ||
	            getDefaultsFromCookie());
	    }
	    catch (e) {
	        /**
	         * Catch-all for being unable to get __FIREBASE_DEFAULTS__ due
	         * to any environment case we have not accounted for. Log to
	         * info instead of swallowing so we can find these unknown cases
	         * and add paths for them if needed.
	         */
	        console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);
	        return;
	    }
	};
	/**
	 * Returns emulator host stored in the __FIREBASE_DEFAULTS__ object
	 * for the given product.
	 * @returns a URL host formatted like `127.0.0.1:9999` or `[::1]:4000` if available
	 * @public
	 */
	const getDefaultEmulatorHost = (productName) => { var _a, _b; return (_b = (_a = getDefaults()) === null || _a === void 0 ? void 0 : _a.emulatorHosts) === null || _b === void 0 ? void 0 : _b[productName]; };
	/**
	 * Returns emulator hostname and port stored in the __FIREBASE_DEFAULTS__ object
	 * for the given product.
	 * @returns a pair of hostname and port like `["::1", 4000]` if available
	 * @public
	 */
	const getDefaultEmulatorHostnameAndPort = (productName) => {
	    const host = getDefaultEmulatorHost(productName);
	    if (!host) {
	        return undefined;
	    }
	    const separatorIndex = host.lastIndexOf(':'); // Finding the last since IPv6 addr also has colons.
	    if (separatorIndex <= 0 || separatorIndex + 1 === host.length) {
	        throw new Error(`Invalid host ${host} with no separate hostname and port!`);
	    }
	    // eslint-disable-next-line no-restricted-globals
	    const port = parseInt(host.substring(separatorIndex + 1), 10);
	    if (host[0] === '[') {
	        // Bracket-quoted `[ipv6addr]:port` => return "ipv6addr" (without brackets).
	        return [host.substring(1, separatorIndex - 1), port];
	    }
	    else {
	        return [host.substring(0, separatorIndex), port];
	    }
	};
	/**
	 * Returns Firebase app config stored in the __FIREBASE_DEFAULTS__ object.
	 * @public
	 */
	const getDefaultAppConfig = () => { var _a; return (_a = getDefaults()) === null || _a === void 0 ? void 0 : _a.config; };

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class Deferred {
	    constructor() {
	        this.reject = () => { };
	        this.resolve = () => { };
	        this.promise = new Promise((resolve, reject) => {
	            this.resolve = resolve;
	            this.reject = reject;
	        });
	    }
	    /**
	     * Our API internals are not promisified and cannot because our callback APIs have subtle expectations around
	     * invoking promises inline, which Promises are forbidden to do. This method accepts an optional node-style callback
	     * and returns a node-style callback which will resolve or reject the Deferred's promise.
	     */
	    wrapCallback(callback) {
	        return (error, value) => {
	            if (error) {
	                this.reject(error);
	            }
	            else {
	                this.resolve(value);
	            }
	            if (typeof callback === 'function') {
	                // Attaching noop handler just in case developer wasn't expecting
	                // promises
	                this.promise.catch(() => { });
	                // Some of our callbacks don't expect a value and our own tests
	                // assert that the parameter length is 1
	                if (callback.length === 1) {
	                    callback(error);
	                }
	                else {
	                    callback(error, value);
	                }
	            }
	        };
	    }
	}

	/**
	 * @license
	 * Copyright 2021 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function createMockUserToken(token, projectId) {
	    if (token.uid) {
	        throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');
	    }
	    // Unsecured JWTs use "none" as the algorithm.
	    const header = {
	        alg: 'none',
	        type: 'JWT'
	    };
	    const project = projectId || 'demo-project';
	    const iat = token.iat || 0;
	    const sub = token.sub || token.user_id;
	    if (!sub) {
	        throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");
	    }
	    const payload = Object.assign({ 
	        // Set all required fields to decent defaults
	        iss: `https://securetoken.google.com/${project}`, aud: project, iat, exp: iat + 3600, auth_time: iat, sub, user_id: sub, firebase: {
	            sign_in_provider: 'custom',
	            identities: {}
	        } }, token);
	    // Unsecured JWTs use the empty string as a signature.
	    const signature = '';
	    return [
	        base64urlEncodeWithoutPadding(JSON.stringify(header)),
	        base64urlEncodeWithoutPadding(JSON.stringify(payload)),
	        signature
	    ].join('.');
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Returns navigator.userAgent string or '' if it's not defined.
	 * @return user agent string
	 */
	function getUA() {
	    if (typeof navigator !== 'undefined' &&
	        typeof navigator['userAgent'] === 'string') {
	        return navigator['userAgent'];
	    }
	    else {
	        return '';
	    }
	}
	/**
	 * Detect Cordova / PhoneGap / Ionic frameworks on a mobile device.
	 *
	 * Deliberately does not rely on checking `file://` URLs (as this fails PhoneGap
	 * in the Ripple emulator) nor Cordova `onDeviceReady`, which would normally
	 * wait for a callback.
	 */
	function isMobileCordova() {
	    return (typeof window !== 'undefined' &&
	        // @ts-ignore Setting up an broadly applicable index signature for Window
	        // just to deal with this case would probably be a bad idea.
	        !!(window['cordova'] || window['phonegap'] || window['PhoneGap']) &&
	        /ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(getUA()));
	}
	/**
	 * Detect React Native.
	 *
	 * @return true if ReactNative environment is detected.
	 */
	function isReactNative() {
	    return (typeof navigator === 'object' && navigator['product'] === 'ReactNative');
	}
	/**
	 * Detect whether the current SDK build is the Node version.
	 *
	 * @return true if it's the Node SDK build.
	 */
	function isNodeSdk() {
	    return CONSTANTS.NODE_ADMIN === true;
	}
	/**
	 * This method checks if indexedDB is supported by current browser/service worker context
	 * @return true if indexedDB is supported by current browser/service worker context
	 */
	function isIndexedDBAvailable() {
	    try {
	        return typeof indexedDB === 'object';
	    }
	    catch (e) {
	        return false;
	    }
	}
	/**
	 * This method validates browser/sw context for indexedDB by opening a dummy indexedDB database and reject
	 * if errors occur during the database open operation.
	 *
	 * @throws exception if current browser/sw context can't run idb.open (ex: Safari iframe, Firefox
	 * private browsing)
	 */
	function validateIndexedDBOpenable() {
	    return new Promise((resolve, reject) => {
	        try {
	            let preExist = true;
	            const DB_CHECK_NAME = 'validate-browser-context-for-indexeddb-analytics-module';
	            const request = self.indexedDB.open(DB_CHECK_NAME);
	            request.onsuccess = () => {
	                request.result.close();
	                // delete database only when it doesn't pre-exist
	                if (!preExist) {
	                    self.indexedDB.deleteDatabase(DB_CHECK_NAME);
	                }
	                resolve(true);
	            };
	            request.onupgradeneeded = () => {
	                preExist = false;
	            };
	            request.onerror = () => {
	                var _a;
	                reject(((_a = request.error) === null || _a === void 0 ? void 0 : _a.message) || '');
	            };
	        }
	        catch (error) {
	            reject(error);
	        }
	    });
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * @fileoverview Standardized Firebase Error.
	 *
	 * Usage:
	 *
	 *   // TypeScript string literals for type-safe codes
	 *   type Err =
	 *     'unknown' |
	 *     'object-not-found'
	 *     ;
	 *
	 *   // Closure enum for type-safe error codes
	 *   // at-enum {string}
	 *   var Err = {
	 *     UNKNOWN: 'unknown',
	 *     OBJECT_NOT_FOUND: 'object-not-found',
	 *   }
	 *
	 *   let errors: Map<Err, string> = {
	 *     'generic-error': "Unknown error",
	 *     'file-not-found': "Could not find file: {$file}",
	 *   };
	 *
	 *   // Type-safe function - must pass a valid error code as param.
	 *   let error = new ErrorFactory<Err>('service', 'Service', errors);
	 *
	 *   ...
	 *   throw error.create(Err.GENERIC);
	 *   ...
	 *   throw error.create(Err.FILE_NOT_FOUND, {'file': fileName});
	 *   ...
	 *   // Service: Could not file file: foo.txt (service/file-not-found).
	 *
	 *   catch (e) {
	 *     assert(e.message === "Could not find file: foo.txt.");
	 *     if ((e as FirebaseError)?.code === 'service/file-not-found') {
	 *       console.log("Could not read file: " + e['file']);
	 *     }
	 *   }
	 */
	const ERROR_NAME = 'FirebaseError';
	// Based on code from:
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Custom_Error_Types
	class FirebaseError extends Error {
	    constructor(
	    /** The error code for this error. */
	    code, message, 
	    /** Custom data for this error. */
	    customData) {
	        super(message);
	        this.code = code;
	        this.customData = customData;
	        /** The custom name for all FirebaseErrors. */
	        this.name = ERROR_NAME;
	        // Fix For ES5
	        // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
	        Object.setPrototypeOf(this, FirebaseError.prototype);
	        // Maintains proper stack trace for where our error was thrown.
	        // Only available on V8.
	        if (Error.captureStackTrace) {
	            Error.captureStackTrace(this, ErrorFactory.prototype.create);
	        }
	    }
	}
	class ErrorFactory {
	    constructor(service, serviceName, errors) {
	        this.service = service;
	        this.serviceName = serviceName;
	        this.errors = errors;
	    }
	    create(code, ...data) {
	        const customData = data[0] || {};
	        const fullCode = `${this.service}/${code}`;
	        const template = this.errors[code];
	        const message = template ? replaceTemplate(template, customData) : 'Error';
	        // Service Name: Error message (service/code).
	        const fullMessage = `${this.serviceName}: ${message} (${fullCode}).`;
	        const error = new FirebaseError(fullCode, fullMessage, customData);
	        return error;
	    }
	}
	function replaceTemplate(template, data) {
	    return template.replace(PATTERN, (_, key) => {
	        const value = data[key];
	        return value != null ? String(value) : `<${key}?>`;
	    });
	}
	const PATTERN = /\{\$([^}]+)}/g;

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Evaluates a JSON string into a javascript object.
	 *
	 * @param {string} str A string containing JSON.
	 * @return {*} The javascript object representing the specified JSON.
	 */
	function jsonEval(str) {
	    return JSON.parse(str);
	}
	/**
	 * Returns JSON representing a javascript object.
	 * @param {*} data JavaScript object to be stringified.
	 * @return {string} The JSON contents of the object.
	 */
	function stringify(data) {
	    return JSON.stringify(data);
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Decodes a Firebase auth. token into constituent parts.
	 *
	 * Notes:
	 * - May return with invalid / incomplete claims if there's no native base64 decoding support.
	 * - Doesn't check if the token is actually valid.
	 */
	const decode = function (token) {
	    let header = {}, claims = {}, data = {}, signature = '';
	    try {
	        const parts = token.split('.');
	        header = jsonEval(base64Decode(parts[0]) || '');
	        claims = jsonEval(base64Decode(parts[1]) || '');
	        signature = parts[2];
	        data = claims['d'] || {};
	        delete claims['d'];
	    }
	    catch (e) { }
	    return {
	        header,
	        claims,
	        data,
	        signature
	    };
	};
	/**
	 * Decodes a Firebase auth. token and checks the validity of its format. Expects a valid issued-at time.
	 *
	 * Notes:
	 * - May return a false negative if there's no native base64 decoding support.
	 * - Doesn't check if the token is actually valid.
	 */
	const isValidFormat = function (token) {
	    const decoded = decode(token), claims = decoded.claims;
	    return !!claims && typeof claims === 'object' && claims.hasOwnProperty('iat');
	};
	/**
	 * Attempts to peer into an auth token and determine if it's an admin auth token by looking at the claims portion.
	 *
	 * Notes:
	 * - May return a false negative if there's no native base64 decoding support.
	 * - Doesn't check if the token is actually valid.
	 */
	const isAdmin = function (token) {
	    const claims = decode(token).claims;
	    return typeof claims === 'object' && claims['admin'] === true;
	};

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function contains(obj, key) {
	    return Object.prototype.hasOwnProperty.call(obj, key);
	}
	function safeGet(obj, key) {
	    if (Object.prototype.hasOwnProperty.call(obj, key)) {
	        return obj[key];
	    }
	    else {
	        return undefined;
	    }
	}
	function isEmpty(obj) {
	    for (const key in obj) {
	        if (Object.prototype.hasOwnProperty.call(obj, key)) {
	            return false;
	        }
	    }
	    return true;
	}
	function map(obj, fn, contextObj) {
	    const res = {};
	    for (const key in obj) {
	        if (Object.prototype.hasOwnProperty.call(obj, key)) {
	            res[key] = fn.call(contextObj, obj[key], key, obj);
	        }
	    }
	    return res;
	}
	/**
	 * Deep equal two objects. Support Arrays and Objects.
	 */
	function deepEqual(a, b) {
	    if (a === b) {
	        return true;
	    }
	    const aKeys = Object.keys(a);
	    const bKeys = Object.keys(b);
	    for (const k of aKeys) {
	        if (!bKeys.includes(k)) {
	            return false;
	        }
	        const aProp = a[k];
	        const bProp = b[k];
	        if (isObject(aProp) && isObject(bProp)) {
	            if (!deepEqual(aProp, bProp)) {
	                return false;
	            }
	        }
	        else if (aProp !== bProp) {
	            return false;
	        }
	    }
	    for (const k of bKeys) {
	        if (!aKeys.includes(k)) {
	            return false;
	        }
	    }
	    return true;
	}
	function isObject(thing) {
	    return thing !== null && typeof thing === 'object';
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Returns a querystring-formatted string (e.g. &arg=val&arg2=val2) from a
	 * params object (e.g. {arg: 'val', arg2: 'val2'})
	 * Note: You must prepend it with ? when adding it to a URL.
	 */
	function querystring(querystringParams) {
	    const params = [];
	    for (const [key, value] of Object.entries(querystringParams)) {
	        if (Array.isArray(value)) {
	            value.forEach(arrayVal => {
	                params.push(encodeURIComponent(key) + '=' + encodeURIComponent(arrayVal));
	            });
	        }
	        else {
	            params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
	        }
	    }
	    return params.length ? '&' + params.join('&') : '';
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * @fileoverview SHA-1 cryptographic hash.
	 * Variable names follow the notation in FIPS PUB 180-3:
	 * http://csrc.nist.gov/publications/fips/fips180-3/fips180-3_final.pdf.
	 *
	 * Usage:
	 *   var sha1 = new sha1();
	 *   sha1.update(bytes);
	 *   var hash = sha1.digest();
	 *
	 * Performance:
	 *   Chrome 23:   ~400 Mbit/s
	 *   Firefox 16:  ~250 Mbit/s
	 *
	 */
	/**
	 * SHA-1 cryptographic hash constructor.
	 *
	 * The properties declared here are discussed in the above algorithm document.
	 * @constructor
	 * @final
	 * @struct
	 */
	class Sha1 {
	    constructor() {
	        /**
	         * Holds the previous values of accumulated variables a-e in the compress_
	         * function.
	         * @private
	         */
	        this.chain_ = [];
	        /**
	         * A buffer holding the partially computed hash result.
	         * @private
	         */
	        this.buf_ = [];
	        /**
	         * An array of 80 bytes, each a part of the message to be hashed.  Referred to
	         * as the message schedule in the docs.
	         * @private
	         */
	        this.W_ = [];
	        /**
	         * Contains data needed to pad messages less than 64 bytes.
	         * @private
	         */
	        this.pad_ = [];
	        /**
	         * @private {number}
	         */
	        this.inbuf_ = 0;
	        /**
	         * @private {number}
	         */
	        this.total_ = 0;
	        this.blockSize = 512 / 8;
	        this.pad_[0] = 128;
	        for (let i = 1; i < this.blockSize; ++i) {
	            this.pad_[i] = 0;
	        }
	        this.reset();
	    }
	    reset() {
	        this.chain_[0] = 0x67452301;
	        this.chain_[1] = 0xefcdab89;
	        this.chain_[2] = 0x98badcfe;
	        this.chain_[3] = 0x10325476;
	        this.chain_[4] = 0xc3d2e1f0;
	        this.inbuf_ = 0;
	        this.total_ = 0;
	    }
	    /**
	     * Internal compress helper function.
	     * @param buf Block to compress.
	     * @param offset Offset of the block in the buffer.
	     * @private
	     */
	    compress_(buf, offset) {
	        if (!offset) {
	            offset = 0;
	        }
	        const W = this.W_;
	        // get 16 big endian words
	        if (typeof buf === 'string') {
	            for (let i = 0; i < 16; i++) {
	                // TODO(user): [bug 8140122] Recent versions of Safari for Mac OS and iOS
	                // have a bug that turns the post-increment ++ operator into pre-increment
	                // during JIT compilation.  We have code that depends heavily on SHA-1 for
	                // correctness and which is affected by this bug, so I've removed all uses
	                // of post-increment ++ in which the result value is used.  We can revert
	                // this change once the Safari bug
	                // (https://bugs.webkit.org/show_bug.cgi?id=109036) has been fixed and
	                // most clients have been updated.
	                W[i] =
	                    (buf.charCodeAt(offset) << 24) |
	                        (buf.charCodeAt(offset + 1) << 16) |
	                        (buf.charCodeAt(offset + 2) << 8) |
	                        buf.charCodeAt(offset + 3);
	                offset += 4;
	            }
	        }
	        else {
	            for (let i = 0; i < 16; i++) {
	                W[i] =
	                    (buf[offset] << 24) |
	                        (buf[offset + 1] << 16) |
	                        (buf[offset + 2] << 8) |
	                        buf[offset + 3];
	                offset += 4;
	            }
	        }
	        // expand to 80 words
	        for (let i = 16; i < 80; i++) {
	            const t = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
	            W[i] = ((t << 1) | (t >>> 31)) & 0xffffffff;
	        }
	        let a = this.chain_[0];
	        let b = this.chain_[1];
	        let c = this.chain_[2];
	        let d = this.chain_[3];
	        let e = this.chain_[4];
	        let f, k;
	        // TODO(user): Try to unroll this loop to speed up the computation.
	        for (let i = 0; i < 80; i++) {
	            if (i < 40) {
	                if (i < 20) {
	                    f = d ^ (b & (c ^ d));
	                    k = 0x5a827999;
	                }
	                else {
	                    f = b ^ c ^ d;
	                    k = 0x6ed9eba1;
	                }
	            }
	            else {
	                if (i < 60) {
	                    f = (b & c) | (d & (b | c));
	                    k = 0x8f1bbcdc;
	                }
	                else {
	                    f = b ^ c ^ d;
	                    k = 0xca62c1d6;
	                }
	            }
	            const t = (((a << 5) | (a >>> 27)) + f + e + k + W[i]) & 0xffffffff;
	            e = d;
	            d = c;
	            c = ((b << 30) | (b >>> 2)) & 0xffffffff;
	            b = a;
	            a = t;
	        }
	        this.chain_[0] = (this.chain_[0] + a) & 0xffffffff;
	        this.chain_[1] = (this.chain_[1] + b) & 0xffffffff;
	        this.chain_[2] = (this.chain_[2] + c) & 0xffffffff;
	        this.chain_[3] = (this.chain_[3] + d) & 0xffffffff;
	        this.chain_[4] = (this.chain_[4] + e) & 0xffffffff;
	    }
	    update(bytes, length) {
	        // TODO(johnlenz): tighten the function signature and remove this check
	        if (bytes == null) {
	            return;
	        }
	        if (length === undefined) {
	            length = bytes.length;
	        }
	        const lengthMinusBlock = length - this.blockSize;
	        let n = 0;
	        // Using local instead of member variables gives ~5% speedup on Firefox 16.
	        const buf = this.buf_;
	        let inbuf = this.inbuf_;
	        // The outer while loop should execute at most twice.
	        while (n < length) {
	            // When we have no data in the block to top up, we can directly process the
	            // input buffer (assuming it contains sufficient data). This gives ~25%
	            // speedup on Chrome 23 and ~15% speedup on Firefox 16, but requires that
	            // the data is provided in large chunks (or in multiples of 64 bytes).
	            if (inbuf === 0) {
	                while (n <= lengthMinusBlock) {
	                    this.compress_(bytes, n);
	                    n += this.blockSize;
	                }
	            }
	            if (typeof bytes === 'string') {
	                while (n < length) {
	                    buf[inbuf] = bytes.charCodeAt(n);
	                    ++inbuf;
	                    ++n;
	                    if (inbuf === this.blockSize) {
	                        this.compress_(buf);
	                        inbuf = 0;
	                        // Jump to the outer loop so we use the full-block optimization.
	                        break;
	                    }
	                }
	            }
	            else {
	                while (n < length) {
	                    buf[inbuf] = bytes[n];
	                    ++inbuf;
	                    ++n;
	                    if (inbuf === this.blockSize) {
	                        this.compress_(buf);
	                        inbuf = 0;
	                        // Jump to the outer loop so we use the full-block optimization.
	                        break;
	                    }
	                }
	            }
	        }
	        this.inbuf_ = inbuf;
	        this.total_ += length;
	    }
	    /** @override */
	    digest() {
	        const digest = [];
	        let totalBits = this.total_ * 8;
	        // Add pad 0x80 0x00*.
	        if (this.inbuf_ < 56) {
	            this.update(this.pad_, 56 - this.inbuf_);
	        }
	        else {
	            this.update(this.pad_, this.blockSize - (this.inbuf_ - 56));
	        }
	        // Add # bits.
	        for (let i = this.blockSize - 1; i >= 56; i--) {
	            this.buf_[i] = totalBits & 255;
	            totalBits /= 256; // Don't use bit-shifting here!
	        }
	        this.compress_(this.buf_);
	        let n = 0;
	        for (let i = 0; i < 5; i++) {
	            for (let j = 24; j >= 0; j -= 8) {
	                digest[n] = (this.chain_[i] >> j) & 255;
	                ++n;
	            }
	        }
	        return digest;
	    }
	}
	/**
	 * Generates a string to prefix an error message about failed argument validation
	 *
	 * @param fnName The function name
	 * @param argName The name of the argument
	 * @return The prefix to add to the error thrown for validation.
	 */
	function errorPrefix(fnName, argName) {
	    return `${fnName} failed: ${argName} argument `;
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	// Code originally came from goog.crypt.stringToUtf8ByteArray, but for some reason they
	// automatically replaced '\r\n' with '\n', and they didn't handle surrogate pairs,
	// so it's been modified.
	// Note that not all Unicode characters appear as single characters in JavaScript strings.
	// fromCharCode returns the UTF-16 encoding of a character - so some Unicode characters
	// use 2 characters in JavaScript.  All 4-byte UTF-8 characters begin with a first
	// character in the range 0xD800 - 0xDBFF (the first character of a so-called surrogate
	// pair).
	// See http://www.ecma-international.org/ecma-262/5.1/#sec-15.1.3
	/**
	 * @param {string} str
	 * @return {Array}
	 */
	const stringToByteArray = function (str) {
	    const out = [];
	    let p = 0;
	    for (let i = 0; i < str.length; i++) {
	        let c = str.charCodeAt(i);
	        // Is this the lead surrogate in a surrogate pair?
	        if (c >= 0xd800 && c <= 0xdbff) {
	            const high = c - 0xd800; // the high 10 bits.
	            i++;
	            assert(i < str.length, 'Surrogate pair missing trail surrogate.');
	            const low = str.charCodeAt(i) - 0xdc00; // the low 10 bits.
	            c = 0x10000 + (high << 10) + low;
	        }
	        if (c < 128) {
	            out[p++] = c;
	        }
	        else if (c < 2048) {
	            out[p++] = (c >> 6) | 192;
	            out[p++] = (c & 63) | 128;
	        }
	        else if (c < 65536) {
	            out[p++] = (c >> 12) | 224;
	            out[p++] = ((c >> 6) & 63) | 128;
	            out[p++] = (c & 63) | 128;
	        }
	        else {
	            out[p++] = (c >> 18) | 240;
	            out[p++] = ((c >> 12) & 63) | 128;
	            out[p++] = ((c >> 6) & 63) | 128;
	            out[p++] = (c & 63) | 128;
	        }
	    }
	    return out;
	};
	/**
	 * Calculate length without actually converting; useful for doing cheaper validation.
	 * @param {string} str
	 * @return {number}
	 */
	const stringLength = function (str) {
	    let p = 0;
	    for (let i = 0; i < str.length; i++) {
	        const c = str.charCodeAt(i);
	        if (c < 128) {
	            p++;
	        }
	        else if (c < 2048) {
	            p += 2;
	        }
	        else if (c >= 0xd800 && c <= 0xdbff) {
	            // Lead surrogate of a surrogate pair.  The pair together will take 4 bytes to represent.
	            p += 4;
	            i++; // skip trail surrogate.
	        }
	        else {
	            p += 3;
	        }
	    }
	    return p;
	};

	/**
	 * @license
	 * Copyright 2021 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function getModularInstance(service) {
	    if (service && service._delegate) {
	        return service._delegate;
	    }
	    else {
	        return service;
	    }
	}

	/**
	 * Component for service name T, e.g. `auth`, `auth-internal`
	 */
	class Component {
	    /**
	     *
	     * @param name The public service name, e.g. app, auth, firestore, database
	     * @param instanceFactory Service factory responsible for creating the public interface
	     * @param type whether the service provided by the component is public or private
	     */
	    constructor(name, instanceFactory, type) {
	        this.name = name;
	        this.instanceFactory = instanceFactory;
	        this.type = type;
	        this.multipleInstances = false;
	        /**
	         * Properties to be added to the service namespace
	         */
	        this.serviceProps = {};
	        this.instantiationMode = "LAZY" /* InstantiationMode.LAZY */;
	        this.onInstanceCreated = null;
	    }
	    setInstantiationMode(mode) {
	        this.instantiationMode = mode;
	        return this;
	    }
	    setMultipleInstances(multipleInstances) {
	        this.multipleInstances = multipleInstances;
	        return this;
	    }
	    setServiceProps(props) {
	        this.serviceProps = props;
	        return this;
	    }
	    setInstanceCreatedCallback(callback) {
	        this.onInstanceCreated = callback;
	        return this;
	    }
	}

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const DEFAULT_ENTRY_NAME$1 = '[DEFAULT]';

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Provider for instance for service name T, e.g. 'auth', 'auth-internal'
	 * NameServiceMapping[T] is an alias for the type of the instance
	 */
	class Provider {
	    constructor(name, container) {
	        this.name = name;
	        this.container = container;
	        this.component = null;
	        this.instances = new Map();
	        this.instancesDeferred = new Map();
	        this.instancesOptions = new Map();
	        this.onInitCallbacks = new Map();
	    }
	    /**
	     * @param identifier A provider can provide multiple instances of a service
	     * if this.component.multipleInstances is true.
	     */
	    get(identifier) {
	        // if multipleInstances is not supported, use the default name
	        const normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
	        if (!this.instancesDeferred.has(normalizedIdentifier)) {
	            const deferred = new Deferred();
	            this.instancesDeferred.set(normalizedIdentifier, deferred);
	            if (this.isInitialized(normalizedIdentifier) ||
	                this.shouldAutoInitialize()) {
	                // initialize the service if it can be auto-initialized
	                try {
	                    const instance = this.getOrInitializeService({
	                        instanceIdentifier: normalizedIdentifier
	                    });
	                    if (instance) {
	                        deferred.resolve(instance);
	                    }
	                }
	                catch (e) {
	                    // when the instance factory throws an exception during get(), it should not cause
	                    // a fatal error. We just return the unresolved promise in this case.
	                }
	            }
	        }
	        return this.instancesDeferred.get(normalizedIdentifier).promise;
	    }
	    getImmediate(options) {
	        var _a;
	        // if multipleInstances is not supported, use the default name
	        const normalizedIdentifier = this.normalizeInstanceIdentifier(options === null || options === void 0 ? void 0 : options.identifier);
	        const optional = (_a = options === null || options === void 0 ? void 0 : options.optional) !== null && _a !== void 0 ? _a : false;
	        if (this.isInitialized(normalizedIdentifier) ||
	            this.shouldAutoInitialize()) {
	            try {
	                return this.getOrInitializeService({
	                    instanceIdentifier: normalizedIdentifier
	                });
	            }
	            catch (e) {
	                if (optional) {
	                    return null;
	                }
	                else {
	                    throw e;
	                }
	            }
	        }
	        else {
	            // In case a component is not initialized and should/cannot be auto-initialized at the moment, return null if the optional flag is set, or throw
	            if (optional) {
	                return null;
	            }
	            else {
	                throw Error(`Service ${this.name} is not available`);
	            }
	        }
	    }
	    getComponent() {
	        return this.component;
	    }
	    setComponent(component) {
	        if (component.name !== this.name) {
	            throw Error(`Mismatching Component ${component.name} for Provider ${this.name}.`);
	        }
	        if (this.component) {
	            throw Error(`Component for ${this.name} has already been provided`);
	        }
	        this.component = component;
	        // return early without attempting to initialize the component if the component requires explicit initialization (calling `Provider.initialize()`)
	        if (!this.shouldAutoInitialize()) {
	            return;
	        }
	        // if the service is eager, initialize the default instance
	        if (isComponentEager(component)) {
	            try {
	                this.getOrInitializeService({ instanceIdentifier: DEFAULT_ENTRY_NAME$1 });
	            }
	            catch (e) {
	                // when the instance factory for an eager Component throws an exception during the eager
	                // initialization, it should not cause a fatal error.
	                // TODO: Investigate if we need to make it configurable, because some component may want to cause
	                // a fatal error in this case?
	            }
	        }
	        // Create service instances for the pending promises and resolve them
	        // NOTE: if this.multipleInstances is false, only the default instance will be created
	        // and all promises with resolve with it regardless of the identifier.
	        for (const [instanceIdentifier, instanceDeferred] of this.instancesDeferred.entries()) {
	            const normalizedIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
	            try {
	                // `getOrInitializeService()` should always return a valid instance since a component is guaranteed. use ! to make typescript happy.
	                const instance = this.getOrInitializeService({
	                    instanceIdentifier: normalizedIdentifier
	                });
	                instanceDeferred.resolve(instance);
	            }
	            catch (e) {
	                // when the instance factory throws an exception, it should not cause
	                // a fatal error. We just leave the promise unresolved.
	            }
	        }
	    }
	    clearInstance(identifier = DEFAULT_ENTRY_NAME$1) {
	        this.instancesDeferred.delete(identifier);
	        this.instancesOptions.delete(identifier);
	        this.instances.delete(identifier);
	    }
	    // app.delete() will call this method on every provider to delete the services
	    // TODO: should we mark the provider as deleted?
	    async delete() {
	        const services = Array.from(this.instances.values());
	        await Promise.all([
	            ...services
	                .filter(service => 'INTERNAL' in service) // legacy services
	                // eslint-disable-next-line @typescript-eslint/no-explicit-any
	                .map(service => service.INTERNAL.delete()),
	            ...services
	                .filter(service => '_delete' in service) // modularized services
	                // eslint-disable-next-line @typescript-eslint/no-explicit-any
	                .map(service => service._delete())
	        ]);
	    }
	    isComponentSet() {
	        return this.component != null;
	    }
	    isInitialized(identifier = DEFAULT_ENTRY_NAME$1) {
	        return this.instances.has(identifier);
	    }
	    getOptions(identifier = DEFAULT_ENTRY_NAME$1) {
	        return this.instancesOptions.get(identifier) || {};
	    }
	    initialize(opts = {}) {
	        const { options = {} } = opts;
	        const normalizedIdentifier = this.normalizeInstanceIdentifier(opts.instanceIdentifier);
	        if (this.isInitialized(normalizedIdentifier)) {
	            throw Error(`${this.name}(${normalizedIdentifier}) has already been initialized`);
	        }
	        if (!this.isComponentSet()) {
	            throw Error(`Component ${this.name} has not been registered yet`);
	        }
	        const instance = this.getOrInitializeService({
	            instanceIdentifier: normalizedIdentifier,
	            options
	        });
	        // resolve any pending promise waiting for the service instance
	        for (const [instanceIdentifier, instanceDeferred] of this.instancesDeferred.entries()) {
	            const normalizedDeferredIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
	            if (normalizedIdentifier === normalizedDeferredIdentifier) {
	                instanceDeferred.resolve(instance);
	            }
	        }
	        return instance;
	    }
	    /**
	     *
	     * @param callback - a function that will be invoked  after the provider has been initialized by calling provider.initialize().
	     * The function is invoked SYNCHRONOUSLY, so it should not execute any longrunning tasks in order to not block the program.
	     *
	     * @param identifier An optional instance identifier
	     * @returns a function to unregister the callback
	     */
	    onInit(callback, identifier) {
	        var _a;
	        const normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
	        const existingCallbacks = (_a = this.onInitCallbacks.get(normalizedIdentifier)) !== null && _a !== void 0 ? _a : new Set();
	        existingCallbacks.add(callback);
	        this.onInitCallbacks.set(normalizedIdentifier, existingCallbacks);
	        const existingInstance = this.instances.get(normalizedIdentifier);
	        if (existingInstance) {
	            callback(existingInstance, normalizedIdentifier);
	        }
	        return () => {
	            existingCallbacks.delete(callback);
	        };
	    }
	    /**
	     * Invoke onInit callbacks synchronously
	     * @param instance the service instance`
	     */
	    invokeOnInitCallbacks(instance, identifier) {
	        const callbacks = this.onInitCallbacks.get(identifier);
	        if (!callbacks) {
	            return;
	        }
	        for (const callback of callbacks) {
	            try {
	                callback(instance, identifier);
	            }
	            catch (_a) {
	                // ignore errors in the onInit callback
	            }
	        }
	    }
	    getOrInitializeService({ instanceIdentifier, options = {} }) {
	        let instance = this.instances.get(instanceIdentifier);
	        if (!instance && this.component) {
	            instance = this.component.instanceFactory(this.container, {
	                instanceIdentifier: normalizeIdentifierForFactory(instanceIdentifier),
	                options
	            });
	            this.instances.set(instanceIdentifier, instance);
	            this.instancesOptions.set(instanceIdentifier, options);
	            /**
	             * Invoke onInit listeners.
	             * Note this.component.onInstanceCreated is different, which is used by the component creator,
	             * while onInit listeners are registered by consumers of the provider.
	             */
	            this.invokeOnInitCallbacks(instance, instanceIdentifier);
	            /**
	             * Order is important
	             * onInstanceCreated() should be called after this.instances.set(instanceIdentifier, instance); which
	             * makes `isInitialized()` return true.
	             */
	            if (this.component.onInstanceCreated) {
	                try {
	                    this.component.onInstanceCreated(this.container, instanceIdentifier, instance);
	                }
	                catch (_a) {
	                    // ignore errors in the onInstanceCreatedCallback
	                }
	            }
	        }
	        return instance || null;
	    }
	    normalizeInstanceIdentifier(identifier = DEFAULT_ENTRY_NAME$1) {
	        if (this.component) {
	            return this.component.multipleInstances ? identifier : DEFAULT_ENTRY_NAME$1;
	        }
	        else {
	            return identifier; // assume multiple instances are supported before the component is provided.
	        }
	    }
	    shouldAutoInitialize() {
	        return (!!this.component &&
	            this.component.instantiationMode !== "EXPLICIT" /* InstantiationMode.EXPLICIT */);
	    }
	}
	// undefined should be passed to the service factory for the default instance
	function normalizeIdentifierForFactory(identifier) {
	    return identifier === DEFAULT_ENTRY_NAME$1 ? undefined : identifier;
	}
	function isComponentEager(component) {
	    return component.instantiationMode === "EAGER" /* InstantiationMode.EAGER */;
	}

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * ComponentContainer that provides Providers for service name T, e.g. `auth`, `auth-internal`
	 */
	class ComponentContainer {
	    constructor(name) {
	        this.name = name;
	        this.providers = new Map();
	    }
	    /**
	     *
	     * @param component Component being added
	     * @param overwrite When a component with the same name has already been registered,
	     * if overwrite is true: overwrite the existing component with the new component and create a new
	     * provider with the new component. It can be useful in tests where you want to use different mocks
	     * for different tests.
	     * if overwrite is false: throw an exception
	     */
	    addComponent(component) {
	        const provider = this.getProvider(component.name);
	        if (provider.isComponentSet()) {
	            throw new Error(`Component ${component.name} has already been registered with ${this.name}`);
	        }
	        provider.setComponent(component);
	    }
	    addOrOverwriteComponent(component) {
	        const provider = this.getProvider(component.name);
	        if (provider.isComponentSet()) {
	            // delete the existing provider from the container, so we can register the new component
	            this.providers.delete(component.name);
	        }
	        this.addComponent(component);
	    }
	    /**
	     * getProvider provides a type safe interface where it can only be called with a field name
	     * present in NameServiceMapping interface.
	     *
	     * Firebase SDKs providing services should extend NameServiceMapping interface to register
	     * themselves.
	     */
	    getProvider(name) {
	        if (this.providers.has(name)) {
	            return this.providers.get(name);
	        }
	        // create a Provider for a service that hasn't registered with Firebase
	        const provider = new Provider(name, this);
	        this.providers.set(name, provider);
	        return provider;
	    }
	    getProviders() {
	        return Array.from(this.providers.values());
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * A container for all of the Logger instances
	 */
	/**
	 * The JS SDK supports 5 log levels and also allows a user the ability to
	 * silence the logs altogether.
	 *
	 * The order is a follows:
	 * DEBUG < VERBOSE < INFO < WARN < ERROR
	 *
	 * All of the log types above the current log level will be captured (i.e. if
	 * you set the log level to `INFO`, errors will still be logged, but `DEBUG` and
	 * `VERBOSE` logs will not)
	 */
	var LogLevel;
	(function (LogLevel) {
	    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
	    LogLevel[LogLevel["VERBOSE"] = 1] = "VERBOSE";
	    LogLevel[LogLevel["INFO"] = 2] = "INFO";
	    LogLevel[LogLevel["WARN"] = 3] = "WARN";
	    LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
	    LogLevel[LogLevel["SILENT"] = 5] = "SILENT";
	})(LogLevel || (LogLevel = {}));
	const levelStringToEnum = {
	    'debug': LogLevel.DEBUG,
	    'verbose': LogLevel.VERBOSE,
	    'info': LogLevel.INFO,
	    'warn': LogLevel.WARN,
	    'error': LogLevel.ERROR,
	    'silent': LogLevel.SILENT
	};
	/**
	 * The default log level
	 */
	const defaultLogLevel = LogLevel.INFO;
	/**
	 * By default, `console.debug` is not displayed in the developer console (in
	 * chrome). To avoid forcing users to have to opt-in to these logs twice
	 * (i.e. once for firebase, and once in the console), we are sending `DEBUG`
	 * logs to the `console.log` function.
	 */
	const ConsoleMethod = {
	    [LogLevel.DEBUG]: 'log',
	    [LogLevel.VERBOSE]: 'log',
	    [LogLevel.INFO]: 'info',
	    [LogLevel.WARN]: 'warn',
	    [LogLevel.ERROR]: 'error'
	};
	/**
	 * The default log handler will forward DEBUG, VERBOSE, INFO, WARN, and ERROR
	 * messages on to their corresponding console counterparts (if the log method
	 * is supported by the current log level)
	 */
	const defaultLogHandler = (instance, logType, ...args) => {
	    if (logType < instance.logLevel) {
	        return;
	    }
	    const now = new Date().toISOString();
	    const method = ConsoleMethod[logType];
	    if (method) {
	        console[method](`[${now}]  ${instance.name}:`, ...args);
	    }
	    else {
	        throw new Error(`Attempted to log a message with an invalid logType (value: ${logType})`);
	    }
	};
	class Logger {
	    /**
	     * Gives you an instance of a Logger to capture messages according to
	     * Firebase's logging scheme.
	     *
	     * @param name The name that the logs will be associated with
	     */
	    constructor(name) {
	        this.name = name;
	        /**
	         * The log level of the given Logger instance.
	         */
	        this._logLevel = defaultLogLevel;
	        /**
	         * The main (internal) log handler for the Logger instance.
	         * Can be set to a new function in internal package code but not by user.
	         */
	        this._logHandler = defaultLogHandler;
	        /**
	         * The optional, additional, user-defined log handler for the Logger instance.
	         */
	        this._userLogHandler = null;
	    }
	    get logLevel() {
	        return this._logLevel;
	    }
	    set logLevel(val) {
	        if (!(val in LogLevel)) {
	            throw new TypeError(`Invalid value "${val}" assigned to \`logLevel\``);
	        }
	        this._logLevel = val;
	    }
	    // Workaround for setter/getter having to be the same type.
	    setLogLevel(val) {
	        this._logLevel = typeof val === 'string' ? levelStringToEnum[val] : val;
	    }
	    get logHandler() {
	        return this._logHandler;
	    }
	    set logHandler(val) {
	        if (typeof val !== 'function') {
	            throw new TypeError('Value assigned to `logHandler` must be a function');
	        }
	        this._logHandler = val;
	    }
	    get userLogHandler() {
	        return this._userLogHandler;
	    }
	    set userLogHandler(val) {
	        this._userLogHandler = val;
	    }
	    /**
	     * The functions below are all based on the `console` interface
	     */
	    debug(...args) {
	        this._userLogHandler && this._userLogHandler(this, LogLevel.DEBUG, ...args);
	        this._logHandler(this, LogLevel.DEBUG, ...args);
	    }
	    log(...args) {
	        this._userLogHandler &&
	            this._userLogHandler(this, LogLevel.VERBOSE, ...args);
	        this._logHandler(this, LogLevel.VERBOSE, ...args);
	    }
	    info(...args) {
	        this._userLogHandler && this._userLogHandler(this, LogLevel.INFO, ...args);
	        this._logHandler(this, LogLevel.INFO, ...args);
	    }
	    warn(...args) {
	        this._userLogHandler && this._userLogHandler(this, LogLevel.WARN, ...args);
	        this._logHandler(this, LogLevel.WARN, ...args);
	    }
	    error(...args) {
	        this._userLogHandler && this._userLogHandler(this, LogLevel.ERROR, ...args);
	        this._logHandler(this, LogLevel.ERROR, ...args);
	    }
	}

	const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

	let idbProxyableTypes;
	let cursorAdvanceMethods;
	// This is a function to prevent it throwing up in node environments.
	function getIdbProxyableTypes() {
	    return (idbProxyableTypes ||
	        (idbProxyableTypes = [
	            IDBDatabase,
	            IDBObjectStore,
	            IDBIndex,
	            IDBCursor,
	            IDBTransaction,
	        ]));
	}
	// This is a function to prevent it throwing up in node environments.
	function getCursorAdvanceMethods() {
	    return (cursorAdvanceMethods ||
	        (cursorAdvanceMethods = [
	            IDBCursor.prototype.advance,
	            IDBCursor.prototype.continue,
	            IDBCursor.prototype.continuePrimaryKey,
	        ]));
	}
	const cursorRequestMap = new WeakMap();
	const transactionDoneMap = new WeakMap();
	const transactionStoreNamesMap = new WeakMap();
	const transformCache = new WeakMap();
	const reverseTransformCache = new WeakMap();
	function promisifyRequest(request) {
	    const promise = new Promise((resolve, reject) => {
	        const unlisten = () => {
	            request.removeEventListener('success', success);
	            request.removeEventListener('error', error);
	        };
	        const success = () => {
	            resolve(wrap(request.result));
	            unlisten();
	        };
	        const error = () => {
	            reject(request.error);
	            unlisten();
	        };
	        request.addEventListener('success', success);
	        request.addEventListener('error', error);
	    });
	    promise
	        .then((value) => {
	        // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
	        // (see wrapFunction).
	        if (value instanceof IDBCursor) {
	            cursorRequestMap.set(value, request);
	        }
	        // Catching to avoid "Uncaught Promise exceptions"
	    })
	        .catch(() => { });
	    // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
	    // is because we create many promises from a single IDBRequest.
	    reverseTransformCache.set(promise, request);
	    return promise;
	}
	function cacheDonePromiseForTransaction(tx) {
	    // Early bail if we've already created a done promise for this transaction.
	    if (transactionDoneMap.has(tx))
	        return;
	    const done = new Promise((resolve, reject) => {
	        const unlisten = () => {
	            tx.removeEventListener('complete', complete);
	            tx.removeEventListener('error', error);
	            tx.removeEventListener('abort', error);
	        };
	        const complete = () => {
	            resolve();
	            unlisten();
	        };
	        const error = () => {
	            reject(tx.error || new DOMException('AbortError', 'AbortError'));
	            unlisten();
	        };
	        tx.addEventListener('complete', complete);
	        tx.addEventListener('error', error);
	        tx.addEventListener('abort', error);
	    });
	    // Cache it for later retrieval.
	    transactionDoneMap.set(tx, done);
	}
	let idbProxyTraps = {
	    get(target, prop, receiver) {
	        if (target instanceof IDBTransaction) {
	            // Special handling for transaction.done.
	            if (prop === 'done')
	                return transactionDoneMap.get(target);
	            // Polyfill for objectStoreNames because of Edge.
	            if (prop === 'objectStoreNames') {
	                return target.objectStoreNames || transactionStoreNamesMap.get(target);
	            }
	            // Make tx.store return the only store in the transaction, or undefined if there are many.
	            if (prop === 'store') {
	                return receiver.objectStoreNames[1]
	                    ? undefined
	                    : receiver.objectStore(receiver.objectStoreNames[0]);
	            }
	        }
	        // Else transform whatever we get back.
	        return wrap(target[prop]);
	    },
	    set(target, prop, value) {
	        target[prop] = value;
	        return true;
	    },
	    has(target, prop) {
	        if (target instanceof IDBTransaction &&
	            (prop === 'done' || prop === 'store')) {
	            return true;
	        }
	        return prop in target;
	    },
	};
	function replaceTraps(callback) {
	    idbProxyTraps = callback(idbProxyTraps);
	}
	function wrapFunction(func) {
	    // Due to expected object equality (which is enforced by the caching in `wrap`), we
	    // only create one new func per func.
	    // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
	    if (func === IDBDatabase.prototype.transaction &&
	        !('objectStoreNames' in IDBTransaction.prototype)) {
	        return function (storeNames, ...args) {
	            const tx = func.call(unwrap(this), storeNames, ...args);
	            transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
	            return wrap(tx);
	        };
	    }
	    // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
	    // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
	    // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
	    // with real promises, so each advance methods returns a new promise for the cursor object, or
	    // undefined if the end of the cursor has been reached.
	    if (getCursorAdvanceMethods().includes(func)) {
	        return function (...args) {
	            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
	            // the original object.
	            func.apply(unwrap(this), args);
	            return wrap(cursorRequestMap.get(this));
	        };
	    }
	    return function (...args) {
	        // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
	        // the original object.
	        return wrap(func.apply(unwrap(this), args));
	    };
	}
	function transformCachableValue(value) {
	    if (typeof value === 'function')
	        return wrapFunction(value);
	    // This doesn't return, it just creates a 'done' promise for the transaction,
	    // which is later returned for transaction.done (see idbObjectHandler).
	    if (value instanceof IDBTransaction)
	        cacheDonePromiseForTransaction(value);
	    if (instanceOfAny(value, getIdbProxyableTypes()))
	        return new Proxy(value, idbProxyTraps);
	    // Return the same value back if we're not going to transform it.
	    return value;
	}
	function wrap(value) {
	    // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
	    // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
	    if (value instanceof IDBRequest)
	        return promisifyRequest(value);
	    // If we've already transformed this value before, reuse the transformed value.
	    // This is faster, but it also provides object equality.
	    if (transformCache.has(value))
	        return transformCache.get(value);
	    const newValue = transformCachableValue(value);
	    // Not all types are transformed.
	    // These may be primitive types, so they can't be WeakMap keys.
	    if (newValue !== value) {
	        transformCache.set(value, newValue);
	        reverseTransformCache.set(newValue, value);
	    }
	    return newValue;
	}
	const unwrap = (value) => reverseTransformCache.get(value);

	/**
	 * Open a database.
	 *
	 * @param name Name of the database.
	 * @param version Schema version.
	 * @param callbacks Additional callbacks.
	 */
	function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
	    const request = indexedDB.open(name, version);
	    const openPromise = wrap(request);
	    if (upgrade) {
	        request.addEventListener('upgradeneeded', (event) => {
	            upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
	        });
	    }
	    if (blocked) {
	        request.addEventListener('blocked', (event) => blocked(
	        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
	        event.oldVersion, event.newVersion, event));
	    }
	    openPromise
	        .then((db) => {
	        if (terminated)
	            db.addEventListener('close', () => terminated());
	        if (blocking) {
	            db.addEventListener('versionchange', (event) => blocking(event.oldVersion, event.newVersion, event));
	        }
	    })
	        .catch(() => { });
	    return openPromise;
	}

	const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
	const writeMethods = ['put', 'add', 'delete', 'clear'];
	const cachedMethods = new Map();
	function getMethod(target, prop) {
	    if (!(target instanceof IDBDatabase &&
	        !(prop in target) &&
	        typeof prop === 'string')) {
	        return;
	    }
	    if (cachedMethods.get(prop))
	        return cachedMethods.get(prop);
	    const targetFuncName = prop.replace(/FromIndex$/, '');
	    const useIndex = prop !== targetFuncName;
	    const isWrite = writeMethods.includes(targetFuncName);
	    if (
	    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
	    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
	        !(isWrite || readMethods.includes(targetFuncName))) {
	        return;
	    }
	    const method = async function (storeName, ...args) {
	        // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
	        const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
	        let target = tx.store;
	        if (useIndex)
	            target = target.index(args.shift());
	        // Must reject if op rejects.
	        // If it's a write operation, must reject if tx.done rejects.
	        // Must reject with op rejection first.
	        // Must resolve with op value.
	        // Must handle both promises (no unhandled rejections)
	        return (await Promise.all([
	            target[targetFuncName](...args),
	            isWrite && tx.done,
	        ]))[0];
	    };
	    cachedMethods.set(prop, method);
	    return method;
	}
	replaceTraps((oldTraps) => ({
	    ...oldTraps,
	    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
	    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
	}));

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class PlatformLoggerServiceImpl {
	    constructor(container) {
	        this.container = container;
	    }
	    // In initial implementation, this will be called by installations on
	    // auth token refresh, and installations will send this string.
	    getPlatformInfoString() {
	        const providers = this.container.getProviders();
	        // Loop through providers and get library/version pairs from any that are
	        // version components.
	        return providers
	            .map(provider => {
	            if (isVersionServiceProvider(provider)) {
	                const service = provider.getImmediate();
	                return `${service.library}/${service.version}`;
	            }
	            else {
	                return null;
	            }
	        })
	            .filter(logString => logString)
	            .join(' ');
	    }
	}
	/**
	 *
	 * @param provider check if this provider provides a VersionService
	 *
	 * NOTE: Using Provider<'app-version'> is a hack to indicate that the provider
	 * provides VersionService. The provider is not necessarily a 'app-version'
	 * provider.
	 */
	function isVersionServiceProvider(provider) {
	    const component = provider.getComponent();
	    return (component === null || component === void 0 ? void 0 : component.type) === "VERSION" /* ComponentType.VERSION */;
	}

	const name$q = "@firebase/app";
	const version$1$1 = "0.10.13";

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const logger$1 = new Logger('@firebase/app');

	const name$p = "@firebase/app-compat";

	const name$o = "@firebase/analytics-compat";

	const name$n = "@firebase/analytics";

	const name$m = "@firebase/app-check-compat";

	const name$l = "@firebase/app-check";

	const name$k = "@firebase/auth";

	const name$j = "@firebase/auth-compat";

	const name$i = "@firebase/database";

	const name$h = "@firebase/data-connect";

	const name$g = "@firebase/database-compat";

	const name$f = "@firebase/functions";

	const name$e = "@firebase/functions-compat";

	const name$d = "@firebase/installations";

	const name$c = "@firebase/installations-compat";

	const name$b = "@firebase/messaging";

	const name$a = "@firebase/messaging-compat";

	const name$9 = "@firebase/performance";

	const name$8 = "@firebase/performance-compat";

	const name$7 = "@firebase/remote-config";

	const name$6 = "@firebase/remote-config-compat";

	const name$5 = "@firebase/storage";

	const name$4 = "@firebase/storage-compat";

	const name$3 = "@firebase/firestore";

	const name$2 = "@firebase/vertexai-preview";

	const name$1$1 = "@firebase/firestore-compat";

	const name$r = "firebase";
	const version$2 = "10.14.1";

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * The default app name
	 *
	 * @internal
	 */
	const DEFAULT_ENTRY_NAME = '[DEFAULT]';
	const PLATFORM_LOG_STRING = {
	    [name$q]: 'fire-core',
	    [name$p]: 'fire-core-compat',
	    [name$n]: 'fire-analytics',
	    [name$o]: 'fire-analytics-compat',
	    [name$l]: 'fire-app-check',
	    [name$m]: 'fire-app-check-compat',
	    [name$k]: 'fire-auth',
	    [name$j]: 'fire-auth-compat',
	    [name$i]: 'fire-rtdb',
	    [name$h]: 'fire-data-connect',
	    [name$g]: 'fire-rtdb-compat',
	    [name$f]: 'fire-fn',
	    [name$e]: 'fire-fn-compat',
	    [name$d]: 'fire-iid',
	    [name$c]: 'fire-iid-compat',
	    [name$b]: 'fire-fcm',
	    [name$a]: 'fire-fcm-compat',
	    [name$9]: 'fire-perf',
	    [name$8]: 'fire-perf-compat',
	    [name$7]: 'fire-rc',
	    [name$6]: 'fire-rc-compat',
	    [name$5]: 'fire-gcs',
	    [name$4]: 'fire-gcs-compat',
	    [name$3]: 'fire-fst',
	    [name$1$1]: 'fire-fst-compat',
	    [name$2]: 'fire-vertex',
	    'fire-js': 'fire-js',
	    [name$r]: 'fire-js-all'
	};

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * @internal
	 */
	const _apps = new Map();
	/**
	 * @internal
	 */
	const _serverApps = new Map();
	/**
	 * Registered components.
	 *
	 * @internal
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const _components = new Map();
	/**
	 * @param component - the component being added to this app's container
	 *
	 * @internal
	 */
	function _addComponent(app, component) {
	    try {
	        app.container.addComponent(component);
	    }
	    catch (e) {
	        logger$1.debug(`Component ${component.name} failed to register with FirebaseApp ${app.name}`, e);
	    }
	}
	/**
	 *
	 * @param component - the component to register
	 * @returns whether or not the component is registered successfully
	 *
	 * @internal
	 */
	function _registerComponent(component) {
	    const componentName = component.name;
	    if (_components.has(componentName)) {
	        logger$1.debug(`There were multiple attempts to register component ${componentName}.`);
	        return false;
	    }
	    _components.set(componentName, component);
	    // add the component to existing app instances
	    for (const app of _apps.values()) {
	        _addComponent(app, component);
	    }
	    for (const serverApp of _serverApps.values()) {
	        _addComponent(serverApp, component);
	    }
	    return true;
	}
	/**
	 *
	 * @param app - FirebaseApp instance
	 * @param name - service name
	 *
	 * @returns the provider for the service with the matching name
	 *
	 * @internal
	 */
	function _getProvider(app, name) {
	    const heartbeatController = app.container
	        .getProvider('heartbeat')
	        .getImmediate({ optional: true });
	    if (heartbeatController) {
	        void heartbeatController.triggerHeartbeat();
	    }
	    return app.container.getProvider(name);
	}

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const ERRORS = {
	    ["no-app" /* AppError.NO_APP */]: "No Firebase App '{$appName}' has been created - " +
	        'call initializeApp() first',
	    ["bad-app-name" /* AppError.BAD_APP_NAME */]: "Illegal App name: '{$appName}'",
	    ["duplicate-app" /* AppError.DUPLICATE_APP */]: "Firebase App named '{$appName}' already exists with different options or config",
	    ["app-deleted" /* AppError.APP_DELETED */]: "Firebase App named '{$appName}' already deleted",
	    ["server-app-deleted" /* AppError.SERVER_APP_DELETED */]: 'Firebase Server App has been deleted',
	    ["no-options" /* AppError.NO_OPTIONS */]: 'Need to provide options, when not being deployed to hosting via source.',
	    ["invalid-app-argument" /* AppError.INVALID_APP_ARGUMENT */]: 'firebase.{$appName}() takes either no argument or a ' +
	        'Firebase App instance.',
	    ["invalid-log-argument" /* AppError.INVALID_LOG_ARGUMENT */]: 'First argument to `onLog` must be null or a function.',
	    ["idb-open" /* AppError.IDB_OPEN */]: 'Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.',
	    ["idb-get" /* AppError.IDB_GET */]: 'Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.',
	    ["idb-set" /* AppError.IDB_WRITE */]: 'Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.',
	    ["idb-delete" /* AppError.IDB_DELETE */]: 'Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.',
	    ["finalization-registry-not-supported" /* AppError.FINALIZATION_REGISTRY_NOT_SUPPORTED */]: 'FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.',
	    ["invalid-server-app-environment" /* AppError.INVALID_SERVER_APP_ENVIRONMENT */]: 'FirebaseServerApp is not for use in browser environments.'
	};
	const ERROR_FACTORY = new ErrorFactory('app', 'Firebase', ERRORS);

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class FirebaseAppImpl {
	    constructor(options, config, container) {
	        this._isDeleted = false;
	        this._options = Object.assign({}, options);
	        this._config = Object.assign({}, config);
	        this._name = config.name;
	        this._automaticDataCollectionEnabled =
	            config.automaticDataCollectionEnabled;
	        this._container = container;
	        this.container.addComponent(new Component('app', () => this, "PUBLIC" /* ComponentType.PUBLIC */));
	    }
	    get automaticDataCollectionEnabled() {
	        this.checkDestroyed();
	        return this._automaticDataCollectionEnabled;
	    }
	    set automaticDataCollectionEnabled(val) {
	        this.checkDestroyed();
	        this._automaticDataCollectionEnabled = val;
	    }
	    get name() {
	        this.checkDestroyed();
	        return this._name;
	    }
	    get options() {
	        this.checkDestroyed();
	        return this._options;
	    }
	    get config() {
	        this.checkDestroyed();
	        return this._config;
	    }
	    get container() {
	        return this._container;
	    }
	    get isDeleted() {
	        return this._isDeleted;
	    }
	    set isDeleted(val) {
	        this._isDeleted = val;
	    }
	    /**
	     * This function will throw an Error if the App has already been deleted -
	     * use before performing API actions on the App.
	     */
	    checkDestroyed() {
	        if (this.isDeleted) {
	            throw ERROR_FACTORY.create("app-deleted" /* AppError.APP_DELETED */, { appName: this._name });
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * The current SDK version.
	 *
	 * @public
	 */
	const SDK_VERSION$1 = version$2;
	function initializeApp(_options, rawConfig = {}) {
	    let options = _options;
	    if (typeof rawConfig !== 'object') {
	        const name = rawConfig;
	        rawConfig = { name };
	    }
	    const config = Object.assign({ name: DEFAULT_ENTRY_NAME, automaticDataCollectionEnabled: false }, rawConfig);
	    const name = config.name;
	    if (typeof name !== 'string' || !name) {
	        throw ERROR_FACTORY.create("bad-app-name" /* AppError.BAD_APP_NAME */, {
	            appName: String(name)
	        });
	    }
	    options || (options = getDefaultAppConfig());
	    if (!options) {
	        throw ERROR_FACTORY.create("no-options" /* AppError.NO_OPTIONS */);
	    }
	    const existingApp = _apps.get(name);
	    if (existingApp) {
	        // return the existing app if options and config deep equal the ones in the existing app.
	        if (deepEqual(options, existingApp.options) &&
	            deepEqual(config, existingApp.config)) {
	            return existingApp;
	        }
	        else {
	            throw ERROR_FACTORY.create("duplicate-app" /* AppError.DUPLICATE_APP */, { appName: name });
	        }
	    }
	    const container = new ComponentContainer(name);
	    for (const component of _components.values()) {
	        container.addComponent(component);
	    }
	    const newApp = new FirebaseAppImpl(options, config, container);
	    _apps.set(name, newApp);
	    return newApp;
	}
	/**
	 * Retrieves a {@link @firebase/app#FirebaseApp} instance.
	 *
	 * When called with no arguments, the default app is returned. When an app name
	 * is provided, the app corresponding to that name is returned.
	 *
	 * An exception is thrown if the app being retrieved has not yet been
	 * initialized.
	 *
	 * @example
	 * ```javascript
	 * // Return the default app
	 * const app = getApp();
	 * ```
	 *
	 * @example
	 * ```javascript
	 * // Return a named app
	 * const otherApp = getApp("otherApp");
	 * ```
	 *
	 * @param name - Optional name of the app to return. If no name is
	 *   provided, the default is `"[DEFAULT]"`.
	 *
	 * @returns The app corresponding to the provided app name.
	 *   If no app name is provided, the default app is returned.
	 *
	 * @public
	 */
	function getApp(name = DEFAULT_ENTRY_NAME) {
	    const app = _apps.get(name);
	    if (!app && name === DEFAULT_ENTRY_NAME && getDefaultAppConfig()) {
	        return initializeApp();
	    }
	    if (!app) {
	        throw ERROR_FACTORY.create("no-app" /* AppError.NO_APP */, { appName: name });
	    }
	    return app;
	}
	/**
	 * Registers a library's name and version for platform logging purposes.
	 * @param library - Name of 1p or 3p library (e.g. firestore, angularfire)
	 * @param version - Current version of that library.
	 * @param variant - Bundle variant, e.g., node, rn, etc.
	 *
	 * @public
	 */
	function registerVersion(libraryKeyOrName, version, variant) {
	    var _a;
	    // TODO: We can use this check to whitelist strings when/if we set up
	    // a good whitelist system.
	    let library = (_a = PLATFORM_LOG_STRING[libraryKeyOrName]) !== null && _a !== void 0 ? _a : libraryKeyOrName;
	    if (variant) {
	        library += `-${variant}`;
	    }
	    const libraryMismatch = library.match(/\s|\//);
	    const versionMismatch = version.match(/\s|\//);
	    if (libraryMismatch || versionMismatch) {
	        const warning = [
	            `Unable to register library "${library}" with version "${version}":`
	        ];
	        if (libraryMismatch) {
	            warning.push(`library name "${library}" contains illegal characters (whitespace or "/")`);
	        }
	        if (libraryMismatch && versionMismatch) {
	            warning.push('and');
	        }
	        if (versionMismatch) {
	            warning.push(`version name "${version}" contains illegal characters (whitespace or "/")`);
	        }
	        logger$1.warn(warning.join(' '));
	        return;
	    }
	    _registerComponent(new Component(`${library}-version`, () => ({ library, version }), "VERSION" /* ComponentType.VERSION */));
	}

	/**
	 * @license
	 * Copyright 2021 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const DB_NAME = 'firebase-heartbeat-database';
	const DB_VERSION = 1;
	const STORE_NAME = 'firebase-heartbeat-store';
	let dbPromise = null;
	function getDbPromise() {
	    if (!dbPromise) {
	        dbPromise = openDB(DB_NAME, DB_VERSION, {
	            upgrade: (db, oldVersion) => {
	                // We don't use 'break' in this switch statement, the fall-through
	                // behavior is what we want, because if there are multiple versions between
	                // the old version and the current version, we want ALL the migrations
	                // that correspond to those versions to run, not only the last one.
	                // eslint-disable-next-line default-case
	                switch (oldVersion) {
	                    case 0:
	                        try {
	                            db.createObjectStore(STORE_NAME);
	                        }
	                        catch (e) {
	                            // Safari/iOS browsers throw occasional exceptions on
	                            // db.createObjectStore() that may be a bug. Avoid blocking
	                            // the rest of the app functionality.
	                            console.warn(e);
	                        }
	                }
	            }
	        }).catch(e => {
	            throw ERROR_FACTORY.create("idb-open" /* AppError.IDB_OPEN */, {
	                originalErrorMessage: e.message
	            });
	        });
	    }
	    return dbPromise;
	}
	async function readHeartbeatsFromIndexedDB(app) {
	    try {
	        const db = await getDbPromise();
	        const tx = db.transaction(STORE_NAME);
	        const result = await tx.objectStore(STORE_NAME).get(computeKey(app));
	        // We already have the value but tx.done can throw,
	        // so we need to await it here to catch errors
	        await tx.done;
	        return result;
	    }
	    catch (e) {
	        if (e instanceof FirebaseError) {
	            logger$1.warn(e.message);
	        }
	        else {
	            const idbGetError = ERROR_FACTORY.create("idb-get" /* AppError.IDB_GET */, {
	                originalErrorMessage: e === null || e === void 0 ? void 0 : e.message
	            });
	            logger$1.warn(idbGetError.message);
	        }
	    }
	}
	async function writeHeartbeatsToIndexedDB(app, heartbeatObject) {
	    try {
	        const db = await getDbPromise();
	        const tx = db.transaction(STORE_NAME, 'readwrite');
	        const objectStore = tx.objectStore(STORE_NAME);
	        await objectStore.put(heartbeatObject, computeKey(app));
	        await tx.done;
	    }
	    catch (e) {
	        if (e instanceof FirebaseError) {
	            logger$1.warn(e.message);
	        }
	        else {
	            const idbGetError = ERROR_FACTORY.create("idb-set" /* AppError.IDB_WRITE */, {
	                originalErrorMessage: e === null || e === void 0 ? void 0 : e.message
	            });
	            logger$1.warn(idbGetError.message);
	        }
	    }
	}
	function computeKey(app) {
	    return `${app.name}!${app.options.appId}`;
	}

	/**
	 * @license
	 * Copyright 2021 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const MAX_HEADER_BYTES = 1024;
	// 30 days
	const STORED_HEARTBEAT_RETENTION_MAX_MILLIS = 30 * 24 * 60 * 60 * 1000;
	class HeartbeatServiceImpl {
	    constructor(container) {
	        this.container = container;
	        /**
	         * In-memory cache for heartbeats, used by getHeartbeatsHeader() to generate
	         * the header string.
	         * Stores one record per date. This will be consolidated into the standard
	         * format of one record per user agent string before being sent as a header.
	         * Populated from indexedDB when the controller is instantiated and should
	         * be kept in sync with indexedDB.
	         * Leave public for easier testing.
	         */
	        this._heartbeatsCache = null;
	        const app = this.container.getProvider('app').getImmediate();
	        this._storage = new HeartbeatStorageImpl(app);
	        this._heartbeatsCachePromise = this._storage.read().then(result => {
	            this._heartbeatsCache = result;
	            return result;
	        });
	    }
	    /**
	     * Called to report a heartbeat. The function will generate
	     * a HeartbeatsByUserAgent object, update heartbeatsCache, and persist it
	     * to IndexedDB.
	     * Note that we only store one heartbeat per day. So if a heartbeat for today is
	     * already logged, subsequent calls to this function in the same day will be ignored.
	     */
	    async triggerHeartbeat() {
	        var _a, _b;
	        try {
	            const platformLogger = this.container
	                .getProvider('platform-logger')
	                .getImmediate();
	            // This is the "Firebase user agent" string from the platform logger
	            // service, not the browser user agent.
	            const agent = platformLogger.getPlatformInfoString();
	            const date = getUTCDateString();
	            if (((_a = this._heartbeatsCache) === null || _a === void 0 ? void 0 : _a.heartbeats) == null) {
	                this._heartbeatsCache = await this._heartbeatsCachePromise;
	                // If we failed to construct a heartbeats cache, then return immediately.
	                if (((_b = this._heartbeatsCache) === null || _b === void 0 ? void 0 : _b.heartbeats) == null) {
	                    return;
	                }
	            }
	            // Do not store a heartbeat if one is already stored for this day
	            // or if a header has already been sent today.
	            if (this._heartbeatsCache.lastSentHeartbeatDate === date ||
	                this._heartbeatsCache.heartbeats.some(singleDateHeartbeat => singleDateHeartbeat.date === date)) {
	                return;
	            }
	            else {
	                // There is no entry for this date. Create one.
	                this._heartbeatsCache.heartbeats.push({ date, agent });
	            }
	            // Remove entries older than 30 days.
	            this._heartbeatsCache.heartbeats =
	                this._heartbeatsCache.heartbeats.filter(singleDateHeartbeat => {
	                    const hbTimestamp = new Date(singleDateHeartbeat.date).valueOf();
	                    const now = Date.now();
	                    return now - hbTimestamp <= STORED_HEARTBEAT_RETENTION_MAX_MILLIS;
	                });
	            return this._storage.overwrite(this._heartbeatsCache);
	        }
	        catch (e) {
	            logger$1.warn(e);
	        }
	    }
	    /**
	     * Returns a base64 encoded string which can be attached to the heartbeat-specific header directly.
	     * It also clears all heartbeats from memory as well as in IndexedDB.
	     *
	     * NOTE: Consuming product SDKs should not send the header if this method
	     * returns an empty string.
	     */
	    async getHeartbeatsHeader() {
	        var _a;
	        try {
	            if (this._heartbeatsCache === null) {
	                await this._heartbeatsCachePromise;
	            }
	            // If it's still null or the array is empty, there is no data to send.
	            if (((_a = this._heartbeatsCache) === null || _a === void 0 ? void 0 : _a.heartbeats) == null ||
	                this._heartbeatsCache.heartbeats.length === 0) {
	                return '';
	            }
	            const date = getUTCDateString();
	            // Extract as many heartbeats from the cache as will fit under the size limit.
	            const { heartbeatsToSend, unsentEntries } = extractHeartbeatsForHeader(this._heartbeatsCache.heartbeats);
	            const headerString = base64urlEncodeWithoutPadding(JSON.stringify({ version: 2, heartbeats: heartbeatsToSend }));
	            // Store last sent date to prevent another being logged/sent for the same day.
	            this._heartbeatsCache.lastSentHeartbeatDate = date;
	            if (unsentEntries.length > 0) {
	                // Store any unsent entries if they exist.
	                this._heartbeatsCache.heartbeats = unsentEntries;
	                // This seems more likely than emptying the array (below) to lead to some odd state
	                // since the cache isn't empty and this will be called again on the next request,
	                // and is probably safest if we await it.
	                await this._storage.overwrite(this._heartbeatsCache);
	            }
	            else {
	                this._heartbeatsCache.heartbeats = [];
	                // Do not wait for this, to reduce latency.
	                void this._storage.overwrite(this._heartbeatsCache);
	            }
	            return headerString;
	        }
	        catch (e) {
	            logger$1.warn(e);
	            return '';
	        }
	    }
	}
	function getUTCDateString() {
	    const today = new Date();
	    // Returns date format 'YYYY-MM-DD'
	    return today.toISOString().substring(0, 10);
	}
	function extractHeartbeatsForHeader(heartbeatsCache, maxSize = MAX_HEADER_BYTES) {
	    // Heartbeats grouped by user agent in the standard format to be sent in
	    // the header.
	    const heartbeatsToSend = [];
	    // Single date format heartbeats that are not sent.
	    let unsentEntries = heartbeatsCache.slice();
	    for (const singleDateHeartbeat of heartbeatsCache) {
	        // Look for an existing entry with the same user agent.
	        const heartbeatEntry = heartbeatsToSend.find(hb => hb.agent === singleDateHeartbeat.agent);
	        if (!heartbeatEntry) {
	            // If no entry for this user agent exists, create one.
	            heartbeatsToSend.push({
	                agent: singleDateHeartbeat.agent,
	                dates: [singleDateHeartbeat.date]
	            });
	            if (countBytes(heartbeatsToSend) > maxSize) {
	                // If the header would exceed max size, remove the added heartbeat
	                // entry and stop adding to the header.
	                heartbeatsToSend.pop();
	                break;
	            }
	        }
	        else {
	            heartbeatEntry.dates.push(singleDateHeartbeat.date);
	            // If the header would exceed max size, remove the added date
	            // and stop adding to the header.
	            if (countBytes(heartbeatsToSend) > maxSize) {
	                heartbeatEntry.dates.pop();
	                break;
	            }
	        }
	        // Pop unsent entry from queue. (Skipped if adding the entry exceeded
	        // quota and the loop breaks early.)
	        unsentEntries = unsentEntries.slice(1);
	    }
	    return {
	        heartbeatsToSend,
	        unsentEntries
	    };
	}
	class HeartbeatStorageImpl {
	    constructor(app) {
	        this.app = app;
	        this._canUseIndexedDBPromise = this.runIndexedDBEnvironmentCheck();
	    }
	    async runIndexedDBEnvironmentCheck() {
	        if (!isIndexedDBAvailable()) {
	            return false;
	        }
	        else {
	            return validateIndexedDBOpenable()
	                .then(() => true)
	                .catch(() => false);
	        }
	    }
	    /**
	     * Read all heartbeats.
	     */
	    async read() {
	        const canUseIndexedDB = await this._canUseIndexedDBPromise;
	        if (!canUseIndexedDB) {
	            return { heartbeats: [] };
	        }
	        else {
	            const idbHeartbeatObject = await readHeartbeatsFromIndexedDB(this.app);
	            if (idbHeartbeatObject === null || idbHeartbeatObject === void 0 ? void 0 : idbHeartbeatObject.heartbeats) {
	                return idbHeartbeatObject;
	            }
	            else {
	                return { heartbeats: [] };
	            }
	        }
	    }
	    // overwrite the storage with the provided heartbeats
	    async overwrite(heartbeatsObject) {
	        var _a;
	        const canUseIndexedDB = await this._canUseIndexedDBPromise;
	        if (!canUseIndexedDB) {
	            return;
	        }
	        else {
	            const existingHeartbeatsObject = await this.read();
	            return writeHeartbeatsToIndexedDB(this.app, {
	                lastSentHeartbeatDate: (_a = heartbeatsObject.lastSentHeartbeatDate) !== null && _a !== void 0 ? _a : existingHeartbeatsObject.lastSentHeartbeatDate,
	                heartbeats: heartbeatsObject.heartbeats
	            });
	        }
	    }
	    // add heartbeats
	    async add(heartbeatsObject) {
	        var _a;
	        const canUseIndexedDB = await this._canUseIndexedDBPromise;
	        if (!canUseIndexedDB) {
	            return;
	        }
	        else {
	            const existingHeartbeatsObject = await this.read();
	            return writeHeartbeatsToIndexedDB(this.app, {
	                lastSentHeartbeatDate: (_a = heartbeatsObject.lastSentHeartbeatDate) !== null && _a !== void 0 ? _a : existingHeartbeatsObject.lastSentHeartbeatDate,
	                heartbeats: [
	                    ...existingHeartbeatsObject.heartbeats,
	                    ...heartbeatsObject.heartbeats
	                ]
	            });
	        }
	    }
	}
	/**
	 * Calculate bytes of a HeartbeatsByUserAgent array after being wrapped
	 * in a platform logging header JSON object, stringified, and converted
	 * to base 64.
	 */
	function countBytes(heartbeatsCache) {
	    // base64 has a restricted set of characters, all of which should be 1 byte.
	    return base64urlEncodeWithoutPadding(
	    // heartbeatsCache wrapper properties
	    JSON.stringify({ version: 2, heartbeats: heartbeatsCache })).length;
	}

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function registerCoreComponents(variant) {
	    _registerComponent(new Component('platform-logger', container => new PlatformLoggerServiceImpl(container), "PRIVATE" /* ComponentType.PRIVATE */));
	    _registerComponent(new Component('heartbeat', container => new HeartbeatServiceImpl(container), "PRIVATE" /* ComponentType.PRIVATE */));
	    // Register `app` package.
	    registerVersion(name$q, version$1$1, variant);
	    // BUILD_TARGET will be replaced by values like esm5, esm2017, cjs5, etc during the compilation
	    registerVersion(name$q, version$1$1, 'esm2017');
	    // Register platform SDK identifier (no version).
	    registerVersion('fire-js', '');
	}

	/**
	 * Firebase App
	 *
	 * @remarks This package coordinates the communication between the different Firebase components
	 * @packageDocumentation
	 */
	registerCoreComponents('');

	var name$1 = "firebase";
	var version$1 = "10.14.1";

	/**
	 * @license
	 * Copyright 2020 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	registerVersion(name$1, version$1, 'app');

	const name = "@firebase/database";
	const version = "1.0.8";

	/**
	 * @license
	 * Copyright 2019 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/** The semver (www.semver.org) version of the SDK. */
	let SDK_VERSION = '';
	/**
	 * SDK_VERSION should be set before any database instance is created
	 * @internal
	 */
	function setSDKVersion(version) {
	    SDK_VERSION = version;
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Wraps a DOM Storage object and:
	 * - automatically encode objects as JSON strings before storing them to allow us to store arbitrary types.
	 * - prefixes names with "firebase:" to avoid collisions with app data.
	 *
	 * We automatically (see storage.js) create two such wrappers, one for sessionStorage,
	 * and one for localStorage.
	 *
	 */
	class DOMStorageWrapper {
	    /**
	     * @param domStorage_ - The underlying storage object (e.g. localStorage or sessionStorage)
	     */
	    constructor(domStorage_) {
	        this.domStorage_ = domStorage_;
	        // Use a prefix to avoid collisions with other stuff saved by the app.
	        this.prefix_ = 'firebase:';
	    }
	    /**
	     * @param key - The key to save the value under
	     * @param value - The value being stored, or null to remove the key.
	     */
	    set(key, value) {
	        if (value == null) {
	            this.domStorage_.removeItem(this.prefixedName_(key));
	        }
	        else {
	            this.domStorage_.setItem(this.prefixedName_(key), stringify(value));
	        }
	    }
	    /**
	     * @returns The value that was stored under this key, or null
	     */
	    get(key) {
	        const storedVal = this.domStorage_.getItem(this.prefixedName_(key));
	        if (storedVal == null) {
	            return null;
	        }
	        else {
	            return jsonEval(storedVal);
	        }
	    }
	    remove(key) {
	        this.domStorage_.removeItem(this.prefixedName_(key));
	    }
	    prefixedName_(name) {
	        return this.prefix_ + name;
	    }
	    toString() {
	        return this.domStorage_.toString();
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * An in-memory storage implementation that matches the API of DOMStorageWrapper
	 * (TODO: create interface for both to implement).
	 */
	class MemoryStorage {
	    constructor() {
	        this.cache_ = {};
	        this.isInMemoryStorage = true;
	    }
	    set(key, value) {
	        if (value == null) {
	            delete this.cache_[key];
	        }
	        else {
	            this.cache_[key] = value;
	        }
	    }
	    get(key) {
	        if (contains(this.cache_, key)) {
	            return this.cache_[key];
	        }
	        return null;
	    }
	    remove(key) {
	        delete this.cache_[key];
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Helper to create a DOMStorageWrapper or else fall back to MemoryStorage.
	 * TODO: Once MemoryStorage and DOMStorageWrapper have a shared interface this method annotation should change
	 * to reflect this type
	 *
	 * @param domStorageName - Name of the underlying storage object
	 *   (e.g. 'localStorage' or 'sessionStorage').
	 * @returns Turning off type information until a common interface is defined.
	 */
	const createStoragefor = function (domStorageName) {
	    try {
	        // NOTE: just accessing "localStorage" or "window['localStorage']" may throw a security exception,
	        // so it must be inside the try/catch.
	        if (typeof window !== 'undefined' &&
	            typeof window[domStorageName] !== 'undefined') {
	            // Need to test cache. Just because it's here doesn't mean it works
	            const domStorage = window[domStorageName];
	            domStorage.setItem('firebase:sentinel', 'cache');
	            domStorage.removeItem('firebase:sentinel');
	            return new DOMStorageWrapper(domStorage);
	        }
	    }
	    catch (e) { }
	    // Failed to create wrapper.  Just return in-memory storage.
	    // TODO: log?
	    return new MemoryStorage();
	};
	/** A storage object that lasts across sessions */
	const PersistentStorage = createStoragefor('localStorage');
	/** A storage object that only lasts one session */
	const SessionStorage = createStoragefor('sessionStorage');

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const logClient = new Logger('@firebase/database');
	/**
	 * Returns a locally-unique ID (generated by just incrementing up from 0 each time its called).
	 */
	const LUIDGenerator = (function () {
	    let id = 1;
	    return function () {
	        return id++;
	    };
	})();
	/**
	 * Sha1 hash of the input string
	 * @param str - The string to hash
	 * @returns {!string} The resulting hash
	 */
	const sha1 = function (str) {
	    const utf8Bytes = stringToByteArray(str);
	    const sha1 = new Sha1();
	    sha1.update(utf8Bytes);
	    const sha1Bytes = sha1.digest();
	    return base64.encodeByteArray(sha1Bytes);
	};
	const buildLogMessage_ = function (...varArgs) {
	    let message = '';
	    for (let i = 0; i < varArgs.length; i++) {
	        const arg = varArgs[i];
	        if (Array.isArray(arg) ||
	            (arg &&
	                typeof arg === 'object' &&
	                // eslint-disable-next-line @typescript-eslint/no-explicit-any
	                typeof arg.length === 'number')) {
	            message += buildLogMessage_.apply(null, arg);
	        }
	        else if (typeof arg === 'object') {
	            message += stringify(arg);
	        }
	        else {
	            message += arg;
	        }
	        message += ' ';
	    }
	    return message;
	};
	/**
	 * Use this for all debug messages in Firebase.
	 */
	let logger = null;
	/**
	 * Flag to check for log availability on first log message
	 */
	let firstLog_ = true;
	/**
	 * The implementation of Firebase.enableLogging (defined here to break dependencies)
	 * @param logger_ - A flag to turn on logging, or a custom logger
	 * @param persistent - Whether or not to persist logging settings across refreshes
	 */
	const enableLogging$1 = function (logger_, persistent) {
	    assert(!persistent || logger_ === true || logger_ === false, "Can't turn on custom loggers persistently.");
	    if (logger_ === true) {
	        logClient.logLevel = LogLevel.VERBOSE;
	        logger = logClient.log.bind(logClient);
	        if (persistent) {
	            SessionStorage.set('logging_enabled', true);
	        }
	    }
	    else if (typeof logger_ === 'function') {
	        logger = logger_;
	    }
	    else {
	        logger = null;
	        SessionStorage.remove('logging_enabled');
	    }
	};
	const log = function (...varArgs) {
	    if (firstLog_ === true) {
	        firstLog_ = false;
	        if (logger === null && SessionStorage.get('logging_enabled') === true) {
	            enableLogging$1(true);
	        }
	    }
	    if (logger) {
	        const message = buildLogMessage_.apply(null, varArgs);
	        logger(message);
	    }
	};
	const logWrapper = function (prefix) {
	    return function (...varArgs) {
	        log(prefix, ...varArgs);
	    };
	};
	const error = function (...varArgs) {
	    const message = 'FIREBASE INTERNAL ERROR: ' + buildLogMessage_(...varArgs);
	    logClient.error(message);
	};
	const fatal = function (...varArgs) {
	    const message = `FIREBASE FATAL ERROR: ${buildLogMessage_(...varArgs)}`;
	    logClient.error(message);
	    throw new Error(message);
	};
	const warn = function (...varArgs) {
	    const message = 'FIREBASE WARNING: ' + buildLogMessage_(...varArgs);
	    logClient.warn(message);
	};
	/**
	 * Logs a warning if the containing page uses https. Called when a call to new Firebase
	 * does not use https.
	 */
	const warnIfPageIsSecure = function () {
	    // Be very careful accessing browser globals. Who knows what may or may not exist.
	    if (typeof window !== 'undefined' &&
	        window.location &&
	        window.location.protocol &&
	        window.location.protocol.indexOf('https:') !== -1) {
	        warn('Insecure Firebase access from a secure page. ' +
	            'Please use https in calls to new Firebase().');
	    }
	};
	/**
	 * Returns true if data is NaN, or +/- Infinity.
	 */
	const isInvalidJSONNumber = function (data) {
	    return (typeof data === 'number' &&
	        (data !== data || // NaN
	            data === Number.POSITIVE_INFINITY ||
	            data === Number.NEGATIVE_INFINITY));
	};
	const executeWhenDOMReady = function (fn) {
	    if (document.readyState === 'complete') {
	        fn();
	    }
	    else {
	        // Modeled after jQuery. Try DOMContentLoaded and onreadystatechange (which
	        // fire before onload), but fall back to onload.
	        let called = false;
	        const wrappedFn = function () {
	            if (!document.body) {
	                setTimeout(wrappedFn, Math.floor(10));
	                return;
	            }
	            if (!called) {
	                called = true;
	                fn();
	            }
	        };
	        if (document.addEventListener) {
	            document.addEventListener('DOMContentLoaded', wrappedFn, false);
	            // fallback to onload.
	            window.addEventListener('load', wrappedFn, false);
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        }
	        else if (document.attachEvent) {
	            // IE.
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	            document.attachEvent('onreadystatechange', () => {
	                if (document.readyState === 'complete') {
	                    wrappedFn();
	                }
	            });
	            // fallback to onload.
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	            window.attachEvent('onload', wrappedFn);
	            // jQuery has an extra hack for IE that we could employ (based on
	            // http://javascript.nwbox.com/IEContentLoaded/) But it looks really old.
	            // I'm hoping we don't need it.
	        }
	    }
	};
	/**
	 * Minimum key name. Invalid for actual data, used as a marker to sort before any valid names
	 */
	const MIN_NAME = '[MIN_NAME]';
	/**
	 * Maximum key name. Invalid for actual data, used as a marker to sort above any valid names
	 */
	const MAX_NAME = '[MAX_NAME]';
	/**
	 * Compares valid Firebase key names, plus min and max name
	 */
	const nameCompare = function (a, b) {
	    if (a === b) {
	        return 0;
	    }
	    else if (a === MIN_NAME || b === MAX_NAME) {
	        return -1;
	    }
	    else if (b === MIN_NAME || a === MAX_NAME) {
	        return 1;
	    }
	    else {
	        const aAsInt = tryParseInt(a), bAsInt = tryParseInt(b);
	        if (aAsInt !== null) {
	            if (bAsInt !== null) {
	                return aAsInt - bAsInt === 0 ? a.length - b.length : aAsInt - bAsInt;
	            }
	            else {
	                return -1;
	            }
	        }
	        else if (bAsInt !== null) {
	            return 1;
	        }
	        else {
	            return a < b ? -1 : 1;
	        }
	    }
	};
	/**
	 * @returns {!number} comparison result.
	 */
	const stringCompare = function (a, b) {
	    if (a === b) {
	        return 0;
	    }
	    else if (a < b) {
	        return -1;
	    }
	    else {
	        return 1;
	    }
	};
	const requireKey = function (key, obj) {
	    if (obj && key in obj) {
	        return obj[key];
	    }
	    else {
	        throw new Error('Missing required key (' + key + ') in object: ' + stringify(obj));
	    }
	};
	const ObjectToUniqueKey = function (obj) {
	    if (typeof obj !== 'object' || obj === null) {
	        return stringify(obj);
	    }
	    const keys = [];
	    // eslint-disable-next-line guard-for-in
	    for (const k in obj) {
	        keys.push(k);
	    }
	    // Export as json, but with the keys sorted.
	    keys.sort();
	    let key = '{';
	    for (let i = 0; i < keys.length; i++) {
	        if (i !== 0) {
	            key += ',';
	        }
	        key += stringify(keys[i]);
	        key += ':';
	        key += ObjectToUniqueKey(obj[keys[i]]);
	    }
	    key += '}';
	    return key;
	};
	/**
	 * Splits a string into a number of smaller segments of maximum size
	 * @param str - The string
	 * @param segsize - The maximum number of chars in the string.
	 * @returns The string, split into appropriately-sized chunks
	 */
	const splitStringBySize = function (str, segsize) {
	    const len = str.length;
	    if (len <= segsize) {
	        return [str];
	    }
	    const dataSegs = [];
	    for (let c = 0; c < len; c += segsize) {
	        if (c + segsize > len) {
	            dataSegs.push(str.substring(c, len));
	        }
	        else {
	            dataSegs.push(str.substring(c, c + segsize));
	        }
	    }
	    return dataSegs;
	};
	/**
	 * Apply a function to each (key, value) pair in an object or
	 * apply a function to each (index, value) pair in an array
	 * @param obj - The object or array to iterate over
	 * @param fn - The function to apply
	 */
	function each(obj, fn) {
	    for (const key in obj) {
	        if (obj.hasOwnProperty(key)) {
	            fn(key, obj[key]);
	        }
	    }
	}
	/**
	 * Borrowed from http://hg.secondlife.com/llsd/src/tip/js/typedarray.js (MIT License)
	 * I made one modification at the end and removed the NaN / Infinity
	 * handling (since it seemed broken [caused an overflow] and we don't need it).  See MJL comments.
	 * @param v - A double
	 *
	 */
	const doubleToIEEE754String = function (v) {
	    assert(!isInvalidJSONNumber(v), 'Invalid JSON number'); // MJL
	    const ebits = 11, fbits = 52;
	    const bias = (1 << (ebits - 1)) - 1;
	    let s, e, f, ln, i;
	    // Compute sign, exponent, fraction
	    // Skip NaN / Infinity handling --MJL.
	    if (v === 0) {
	        e = 0;
	        f = 0;
	        s = 1 / v === -Infinity ? 1 : 0;
	    }
	    else {
	        s = v < 0;
	        v = Math.abs(v);
	        if (v >= Math.pow(2, 1 - bias)) {
	            // Normalized
	            ln = Math.min(Math.floor(Math.log(v) / Math.LN2), bias);
	            e = ln + bias;
	            f = Math.round(v * Math.pow(2, fbits - ln) - Math.pow(2, fbits));
	        }
	        else {
	            // Denormalized
	            e = 0;
	            f = Math.round(v / Math.pow(2, 1 - bias - fbits));
	        }
	    }
	    // Pack sign, exponent, fraction
	    const bits = [];
	    for (i = fbits; i; i -= 1) {
	        bits.push(f % 2 ? 1 : 0);
	        f = Math.floor(f / 2);
	    }
	    for (i = ebits; i; i -= 1) {
	        bits.push(e % 2 ? 1 : 0);
	        e = Math.floor(e / 2);
	    }
	    bits.push(s ? 1 : 0);
	    bits.reverse();
	    const str = bits.join('');
	    // Return the data as a hex string. --MJL
	    let hexByteString = '';
	    for (i = 0; i < 64; i += 8) {
	        let hexByte = parseInt(str.substr(i, 8), 2).toString(16);
	        if (hexByte.length === 1) {
	            hexByte = '0' + hexByte;
	        }
	        hexByteString = hexByteString + hexByte;
	    }
	    return hexByteString.toLowerCase();
	};
	/**
	 * Used to detect if we're in a Chrome content script (which executes in an
	 * isolated environment where long-polling doesn't work).
	 */
	const isChromeExtensionContentScript = function () {
	    return !!(typeof window === 'object' &&
	        window['chrome'] &&
	        window['chrome']['extension'] &&
	        !/^chrome/.test(window.location.href));
	};
	/**
	 * Used to detect if we're in a Windows 8 Store app.
	 */
	const isWindowsStoreApp = function () {
	    // Check for the presence of a couple WinRT globals
	    return typeof Windows === 'object' && typeof Windows.UI === 'object';
	};
	/**
	 * Converts a server error code to a JavaScript Error
	 */
	function errorForServerCode(code, query) {
	    let reason = 'Unknown Error';
	    if (code === 'too_big') {
	        reason =
	            'The data requested exceeds the maximum size ' +
	                'that can be accessed with a single request.';
	    }
	    else if (code === 'permission_denied') {
	        reason = "Client doesn't have permission to access the desired data.";
	    }
	    else if (code === 'unavailable') {
	        reason = 'The service is unavailable';
	    }
	    const error = new Error(code + ' at ' + query._path.toString() + ': ' + reason);
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    error.code = code.toUpperCase();
	    return error;
	}
	/**
	 * Used to test for integer-looking strings
	 */
	const INTEGER_REGEXP_ = new RegExp('^-?(0*)\\d{1,10}$');
	/**
	 * For use in keys, the minimum possible 32-bit integer.
	 */
	const INTEGER_32_MIN = -2147483648;
	/**
	 * For use in keys, the maximum possible 32-bit integer.
	 */
	const INTEGER_32_MAX = 2147483647;
	/**
	 * If the string contains a 32-bit integer, return it.  Else return null.
	 */
	const tryParseInt = function (str) {
	    if (INTEGER_REGEXP_.test(str)) {
	        const intVal = Number(str);
	        if (intVal >= INTEGER_32_MIN && intVal <= INTEGER_32_MAX) {
	            return intVal;
	        }
	    }
	    return null;
	};
	/**
	 * Helper to run some code but catch any exceptions and re-throw them later.
	 * Useful for preventing user callbacks from breaking internal code.
	 *
	 * Re-throwing the exception from a setTimeout is a little evil, but it's very
	 * convenient (we don't have to try to figure out when is a safe point to
	 * re-throw it), and the behavior seems reasonable:
	 *
	 * * If you aren't pausing on exceptions, you get an error in the console with
	 *   the correct stack trace.
	 * * If you're pausing on all exceptions, the debugger will pause on your
	 *   exception and then again when we rethrow it.
	 * * If you're only pausing on uncaught exceptions, the debugger will only pause
	 *   on us re-throwing it.
	 *
	 * @param fn - The code to guard.
	 */
	const exceptionGuard = function (fn) {
	    try {
	        fn();
	    }
	    catch (e) {
	        // Re-throw exception when it's safe.
	        setTimeout(() => {
	            // It used to be that "throw e" would result in a good console error with
	            // relevant context, but as of Chrome 39, you just get the firebase.js
	            // file/line number where we re-throw it, which is useless. So we log
	            // e.stack explicitly.
	            const stack = e.stack || '';
	            warn('Exception was thrown by user callback.', stack);
	            throw e;
	        }, Math.floor(0));
	    }
	};
	/**
	 * @returns {boolean} true if we think we're currently being crawled.
	 */
	const beingCrawled = function () {
	    const userAgent = (typeof window === 'object' &&
	        window['navigator'] &&
	        window['navigator']['userAgent']) ||
	        '';
	    // For now we whitelist the most popular crawlers.  We should refine this to be the set of crawlers we
	    // believe to support JavaScript/AJAX rendering.
	    // NOTE: Google Webmaster Tools doesn't really belong, but their "This is how a visitor to your website
	    // would have seen the page" is flaky if we don't treat it as a crawler.
	    return (userAgent.search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i) >= 0);
	};
	/**
	 * Same as setTimeout() except on Node.JS it will /not/ prevent the process from exiting.
	 *
	 * It is removed with clearTimeout() as normal.
	 *
	 * @param fn - Function to run.
	 * @param time - Milliseconds to wait before running.
	 * @returns The setTimeout() return value.
	 */
	const setTimeoutNonBlocking = function (fn, time) {
	    const timeout = setTimeout(fn, time);
	    // Note: at the time of this comment, unrefTimer is under the unstable set of APIs. Run with --unstable to enable the API.
	    if (typeof timeout === 'number' &&
	        // @ts-ignore Is only defined in Deno environments.
	        typeof Deno !== 'undefined' &&
	        // @ts-ignore Deno and unrefTimer are only defined in Deno environments.
	        Deno['unrefTimer']) {
	        // @ts-ignore Deno and unrefTimer are only defined in Deno environments.
	        Deno.unrefTimer(timeout);
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    }
	    else if (typeof timeout === 'object' && timeout['unref']) {
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        timeout['unref']();
	    }
	    return timeout;
	};

	/**
	 * @license
	 * Copyright 2021 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Abstraction around AppCheck's token fetching capabilities.
	 */
	class AppCheckTokenProvider {
	    constructor(appName_, appCheckProvider) {
	        this.appName_ = appName_;
	        this.appCheckProvider = appCheckProvider;
	        this.appCheck = appCheckProvider === null || appCheckProvider === void 0 ? void 0 : appCheckProvider.getImmediate({ optional: true });
	        if (!this.appCheck) {
	            appCheckProvider === null || appCheckProvider === void 0 ? void 0 : appCheckProvider.get().then(appCheck => (this.appCheck = appCheck));
	        }
	    }
	    getToken(forceRefresh) {
	        if (!this.appCheck) {
	            return new Promise((resolve, reject) => {
	                // Support delayed initialization of FirebaseAppCheck. This allows our
	                // customers to initialize the RTDB SDK before initializing Firebase
	                // AppCheck and ensures that all requests are authenticated if a token
	                // becomes available before the timeout below expires.
	                setTimeout(() => {
	                    if (this.appCheck) {
	                        this.getToken(forceRefresh).then(resolve, reject);
	                    }
	                    else {
	                        resolve(null);
	                    }
	                }, 0);
	            });
	        }
	        return this.appCheck.getToken(forceRefresh);
	    }
	    addTokenChangeListener(listener) {
	        var _a;
	        (_a = this.appCheckProvider) === null || _a === void 0 ? void 0 : _a.get().then(appCheck => appCheck.addTokenListener(listener));
	    }
	    notifyForInvalidToken() {
	        warn(`Provided AppCheck credentials for the app named "${this.appName_}" ` +
	            'are invalid. This usually indicates your app was not initialized correctly.');
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Abstraction around FirebaseApp's token fetching capabilities.
	 */
	class FirebaseAuthTokenProvider {
	    constructor(appName_, firebaseOptions_, authProvider_) {
	        this.appName_ = appName_;
	        this.firebaseOptions_ = firebaseOptions_;
	        this.authProvider_ = authProvider_;
	        this.auth_ = null;
	        this.auth_ = authProvider_.getImmediate({ optional: true });
	        if (!this.auth_) {
	            authProvider_.onInit(auth => (this.auth_ = auth));
	        }
	    }
	    getToken(forceRefresh) {
	        if (!this.auth_) {
	            return new Promise((resolve, reject) => {
	                // Support delayed initialization of FirebaseAuth. This allows our
	                // customers to initialize the RTDB SDK before initializing Firebase
	                // Auth and ensures that all requests are authenticated if a token
	                // becomes available before the timeout below expires.
	                setTimeout(() => {
	                    if (this.auth_) {
	                        this.getToken(forceRefresh).then(resolve, reject);
	                    }
	                    else {
	                        resolve(null);
	                    }
	                }, 0);
	            });
	        }
	        return this.auth_.getToken(forceRefresh).catch(error => {
	            // TODO: Need to figure out all the cases this is raised and whether
	            // this makes sense.
	            if (error && error.code === 'auth/token-not-initialized') {
	                log('Got auth/token-not-initialized error.  Treating as null token.');
	                return null;
	            }
	            else {
	                return Promise.reject(error);
	            }
	        });
	    }
	    addTokenChangeListener(listener) {
	        // TODO: We might want to wrap the listener and call it with no args to
	        // avoid a leaky abstraction, but that makes removing the listener harder.
	        if (this.auth_) {
	            this.auth_.addAuthTokenListener(listener);
	        }
	        else {
	            this.authProvider_
	                .get()
	                .then(auth => auth.addAuthTokenListener(listener));
	        }
	    }
	    removeTokenChangeListener(listener) {
	        this.authProvider_
	            .get()
	            .then(auth => auth.removeAuthTokenListener(listener));
	    }
	    notifyForInvalidToken() {
	        let errorMessage = 'Provided authentication credentials for the app named "' +
	            this.appName_ +
	            '" are invalid. This usually indicates your app was not ' +
	            'initialized correctly. ';
	        if ('credential' in this.firebaseOptions_) {
	            errorMessage +=
	                'Make sure the "credential" property provided to initializeApp() ' +
	                    'is authorized to access the specified "databaseURL" and is from the correct ' +
	                    'project.';
	        }
	        else if ('serviceAccount' in this.firebaseOptions_) {
	            errorMessage +=
	                'Make sure the "serviceAccount" property provided to initializeApp() ' +
	                    'is authorized to access the specified "databaseURL" and is from the correct ' +
	                    'project.';
	        }
	        else {
	            errorMessage +=
	                'Make sure the "apiKey" and "databaseURL" properties provided to ' +
	                    'initializeApp() match the values provided for your app at ' +
	                    'https://console.firebase.google.com/.';
	        }
	        warn(errorMessage);
	    }
	}
	/* AuthTokenProvider that supplies a constant token. Used by Admin SDK or mockUserToken with emulators. */
	class EmulatorTokenProvider {
	    constructor(accessToken) {
	        this.accessToken = accessToken;
	    }
	    getToken(forceRefresh) {
	        return Promise.resolve({
	            accessToken: this.accessToken
	        });
	    }
	    addTokenChangeListener(listener) {
	        // Invoke the listener immediately to match the behavior in Firebase Auth
	        // (see packages/auth/src/auth.js#L1807)
	        listener(this.accessToken);
	    }
	    removeTokenChangeListener(listener) { }
	    notifyForInvalidToken() { }
	}
	/** A string that is treated as an admin access token by the RTDB emulator. Used by Admin SDK. */
	EmulatorTokenProvider.OWNER = 'owner';

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const PROTOCOL_VERSION = '5';
	const VERSION_PARAM = 'v';
	const TRANSPORT_SESSION_PARAM = 's';
	const REFERER_PARAM = 'r';
	const FORGE_REF = 'f';
	// Matches console.firebase.google.com, firebase-console-*.corp.google.com and
	// firebase.corp.google.com
	const FORGE_DOMAIN_RE = /(console\.firebase|firebase-console-\w+\.corp|firebase\.corp)\.google\.com/;
	const LAST_SESSION_PARAM = 'ls';
	const APPLICATION_ID_PARAM = 'p';
	const APP_CHECK_TOKEN_PARAM = 'ac';
	const WEBSOCKET = 'websocket';
	const LONG_POLLING = 'long_polling';

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * A class that holds metadata about a Repo object
	 */
	class RepoInfo {
	    /**
	     * @param host - Hostname portion of the url for the repo
	     * @param secure - Whether or not this repo is accessed over ssl
	     * @param namespace - The namespace represented by the repo
	     * @param webSocketOnly - Whether to prefer websockets over all other transports (used by Nest).
	     * @param nodeAdmin - Whether this instance uses Admin SDK credentials
	     * @param persistenceKey - Override the default session persistence storage key
	     */
	    constructor(host, secure, namespace, webSocketOnly, nodeAdmin = false, persistenceKey = '', includeNamespaceInQueryParams = false, isUsingEmulator = false) {
	        this.secure = secure;
	        this.namespace = namespace;
	        this.webSocketOnly = webSocketOnly;
	        this.nodeAdmin = nodeAdmin;
	        this.persistenceKey = persistenceKey;
	        this.includeNamespaceInQueryParams = includeNamespaceInQueryParams;
	        this.isUsingEmulator = isUsingEmulator;
	        this._host = host.toLowerCase();
	        this._domain = this._host.substr(this._host.indexOf('.') + 1);
	        this.internalHost =
	            PersistentStorage.get('host:' + host) || this._host;
	    }
	    isCacheableHost() {
	        return this.internalHost.substr(0, 2) === 's-';
	    }
	    isCustomHost() {
	        return (this._domain !== 'firebaseio.com' &&
	            this._domain !== 'firebaseio-demo.com');
	    }
	    get host() {
	        return this._host;
	    }
	    set host(newHost) {
	        if (newHost !== this.internalHost) {
	            this.internalHost = newHost;
	            if (this.isCacheableHost()) {
	                PersistentStorage.set('host:' + this._host, this.internalHost);
	            }
	        }
	    }
	    toString() {
	        let str = this.toURLString();
	        if (this.persistenceKey) {
	            str += '<' + this.persistenceKey + '>';
	        }
	        return str;
	    }
	    toURLString() {
	        const protocol = this.secure ? 'https://' : 'http://';
	        const query = this.includeNamespaceInQueryParams
	            ? `?ns=${this.namespace}`
	            : '';
	        return `${protocol}${this.host}/${query}`;
	    }
	}
	function repoInfoNeedsQueryParam(repoInfo) {
	    return (repoInfo.host !== repoInfo.internalHost ||
	        repoInfo.isCustomHost() ||
	        repoInfo.includeNamespaceInQueryParams);
	}
	/**
	 * Returns the websocket URL for this repo
	 * @param repoInfo - RepoInfo object
	 * @param type - of connection
	 * @param params - list
	 * @returns The URL for this repo
	 */
	function repoInfoConnectionURL(repoInfo, type, params) {
	    assert(typeof type === 'string', 'typeof type must == string');
	    assert(typeof params === 'object', 'typeof params must == object');
	    let connURL;
	    if (type === WEBSOCKET) {
	        connURL =
	            (repoInfo.secure ? 'wss://' : 'ws://') + repoInfo.internalHost + '/.ws?';
	    }
	    else if (type === LONG_POLLING) {
	        connURL =
	            (repoInfo.secure ? 'https://' : 'http://') +
	                repoInfo.internalHost +
	                '/.lp?';
	    }
	    else {
	        throw new Error('Unknown connection type: ' + type);
	    }
	    if (repoInfoNeedsQueryParam(repoInfo)) {
	        params['ns'] = repoInfo.namespace;
	    }
	    const pairs = [];
	    each(params, (key, value) => {
	        pairs.push(key + '=' + value);
	    });
	    return connURL + pairs.join('&');
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Tracks a collection of stats.
	 */
	class StatsCollection {
	    constructor() {
	        this.counters_ = {};
	    }
	    incrementCounter(name, amount = 1) {
	        if (!contains(this.counters_, name)) {
	            this.counters_[name] = 0;
	        }
	        this.counters_[name] += amount;
	    }
	    get() {
	        return deepCopy(this.counters_);
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const collections = {};
	const reporters = {};
	function statsManagerGetCollection(repoInfo) {
	    const hashString = repoInfo.toString();
	    if (!collections[hashString]) {
	        collections[hashString] = new StatsCollection();
	    }
	    return collections[hashString];
	}
	function statsManagerGetOrCreateReporter(repoInfo, creatorFunction) {
	    const hashString = repoInfo.toString();
	    if (!reporters[hashString]) {
	        reporters[hashString] = creatorFunction();
	    }
	    return reporters[hashString];
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * This class ensures the packets from the server arrive in order
	 * This class takes data from the server and ensures it gets passed into the callbacks in order.
	 */
	class PacketReceiver {
	    /**
	     * @param onMessage_
	     */
	    constructor(onMessage_) {
	        this.onMessage_ = onMessage_;
	        this.pendingResponses = [];
	        this.currentResponseNum = 0;
	        this.closeAfterResponse = -1;
	        this.onClose = null;
	    }
	    closeAfter(responseNum, callback) {
	        this.closeAfterResponse = responseNum;
	        this.onClose = callback;
	        if (this.closeAfterResponse < this.currentResponseNum) {
	            this.onClose();
	            this.onClose = null;
	        }
	    }
	    /**
	     * Each message from the server comes with a response number, and an array of data. The responseNumber
	     * allows us to ensure that we process them in the right order, since we can't be guaranteed that all
	     * browsers will respond in the same order as the requests we sent
	     */
	    handleResponse(requestNum, data) {
	        this.pendingResponses[requestNum] = data;
	        while (this.pendingResponses[this.currentResponseNum]) {
	            const toProcess = this.pendingResponses[this.currentResponseNum];
	            delete this.pendingResponses[this.currentResponseNum];
	            for (let i = 0; i < toProcess.length; ++i) {
	                if (toProcess[i]) {
	                    exceptionGuard(() => {
	                        this.onMessage_(toProcess[i]);
	                    });
	                }
	            }
	            if (this.currentResponseNum === this.closeAfterResponse) {
	                if (this.onClose) {
	                    this.onClose();
	                    this.onClose = null;
	                }
	                break;
	            }
	            this.currentResponseNum++;
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	// URL query parameters associated with longpolling
	const FIREBASE_LONGPOLL_START_PARAM = 'start';
	const FIREBASE_LONGPOLL_CLOSE_COMMAND = 'close';
	const FIREBASE_LONGPOLL_COMMAND_CB_NAME = 'pLPCommand';
	const FIREBASE_LONGPOLL_DATA_CB_NAME = 'pRTLPCB';
	const FIREBASE_LONGPOLL_ID_PARAM = 'id';
	const FIREBASE_LONGPOLL_PW_PARAM = 'pw';
	const FIREBASE_LONGPOLL_SERIAL_PARAM = 'ser';
	const FIREBASE_LONGPOLL_CALLBACK_ID_PARAM = 'cb';
	const FIREBASE_LONGPOLL_SEGMENT_NUM_PARAM = 'seg';
	const FIREBASE_LONGPOLL_SEGMENTS_IN_PACKET = 'ts';
	const FIREBASE_LONGPOLL_DATA_PARAM = 'd';
	const FIREBASE_LONGPOLL_DISCONN_FRAME_REQUEST_PARAM = 'dframe';
	//Data size constants.
	//TODO: Perf: the maximum length actually differs from browser to browser.
	// We should check what browser we're on and set accordingly.
	const MAX_URL_DATA_SIZE = 1870;
	const SEG_HEADER_SIZE = 30; //ie: &seg=8299234&ts=982389123&d=
	const MAX_PAYLOAD_SIZE = MAX_URL_DATA_SIZE - SEG_HEADER_SIZE;
	/**
	 * Keepalive period
	 * send a fresh request at minimum every 25 seconds. Opera has a maximum request
	 * length of 30 seconds that we can't exceed.
	 */
	const KEEPALIVE_REQUEST_INTERVAL = 25000;
	/**
	 * How long to wait before aborting a long-polling connection attempt.
	 */
	const LP_CONNECT_TIMEOUT = 30000;
	/**
	 * This class manages a single long-polling connection.
	 */
	class BrowserPollConnection {
	    /**
	     * @param connId An identifier for this connection, used for logging
	     * @param repoInfo The info for the endpoint to send data to.
	     * @param applicationId The Firebase App ID for this project.
	     * @param appCheckToken The AppCheck token for this client.
	     * @param authToken The AuthToken to use for this connection.
	     * @param transportSessionId Optional transportSessionid if we are
	     * reconnecting for an existing transport session
	     * @param lastSessionId Optional lastSessionId if the PersistentConnection has
	     * already created a connection previously
	     */
	    constructor(connId, repoInfo, applicationId, appCheckToken, authToken, transportSessionId, lastSessionId) {
	        this.connId = connId;
	        this.repoInfo = repoInfo;
	        this.applicationId = applicationId;
	        this.appCheckToken = appCheckToken;
	        this.authToken = authToken;
	        this.transportSessionId = transportSessionId;
	        this.lastSessionId = lastSessionId;
	        this.bytesSent = 0;
	        this.bytesReceived = 0;
	        this.everConnected_ = false;
	        this.log_ = logWrapper(connId);
	        this.stats_ = statsManagerGetCollection(repoInfo);
	        this.urlFn = (params) => {
	            // Always add the token if we have one.
	            if (this.appCheckToken) {
	                params[APP_CHECK_TOKEN_PARAM] = this.appCheckToken;
	            }
	            return repoInfoConnectionURL(repoInfo, LONG_POLLING, params);
	        };
	    }
	    /**
	     * @param onMessage - Callback when messages arrive
	     * @param onDisconnect - Callback with connection lost.
	     */
	    open(onMessage, onDisconnect) {
	        this.curSegmentNum = 0;
	        this.onDisconnect_ = onDisconnect;
	        this.myPacketOrderer = new PacketReceiver(onMessage);
	        this.isClosed_ = false;
	        this.connectTimeoutTimer_ = setTimeout(() => {
	            this.log_('Timed out trying to connect.');
	            // Make sure we clear the host cache
	            this.onClosed_();
	            this.connectTimeoutTimer_ = null;
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        }, Math.floor(LP_CONNECT_TIMEOUT));
	        // Ensure we delay the creation of the iframe until the DOM is loaded.
	        executeWhenDOMReady(() => {
	            if (this.isClosed_) {
	                return;
	            }
	            //Set up a callback that gets triggered once a connection is set up.
	            this.scriptTagHolder = new FirebaseIFrameScriptHolder((...args) => {
	                const [command, arg1, arg2, arg3, arg4] = args;
	                this.incrementIncomingBytes_(args);
	                if (!this.scriptTagHolder) {
	                    return; // we closed the connection.
	                }
	                if (this.connectTimeoutTimer_) {
	                    clearTimeout(this.connectTimeoutTimer_);
	                    this.connectTimeoutTimer_ = null;
	                }
	                this.everConnected_ = true;
	                if (command === FIREBASE_LONGPOLL_START_PARAM) {
	                    this.id = arg1;
	                    this.password = arg2;
	                }
	                else if (command === FIREBASE_LONGPOLL_CLOSE_COMMAND) {
	                    // Don't clear the host cache. We got a response from the server, so we know it's reachable
	                    if (arg1) {
	                        // We aren't expecting any more data (other than what the server's already in the process of sending us
	                        // through our already open polls), so don't send any more.
	                        this.scriptTagHolder.sendNewPolls = false;
	                        // arg1 in this case is the last response number sent by the server. We should try to receive
	                        // all of the responses up to this one before closing
	                        this.myPacketOrderer.closeAfter(arg1, () => {
	                            this.onClosed_();
	                        });
	                    }
	                    else {
	                        this.onClosed_();
	                    }
	                }
	                else {
	                    throw new Error('Unrecognized command received: ' + command);
	                }
	            }, (...args) => {
	                const [pN, data] = args;
	                this.incrementIncomingBytes_(args);
	                this.myPacketOrderer.handleResponse(pN, data);
	            }, () => {
	                this.onClosed_();
	            }, this.urlFn);
	            //Send the initial request to connect. The serial number is simply to keep the browser from pulling previous results
	            //from cache.
	            const urlParams = {};
	            urlParams[FIREBASE_LONGPOLL_START_PARAM] = 't';
	            urlParams[FIREBASE_LONGPOLL_SERIAL_PARAM] = Math.floor(Math.random() * 100000000);
	            if (this.scriptTagHolder.uniqueCallbackIdentifier) {
	                urlParams[FIREBASE_LONGPOLL_CALLBACK_ID_PARAM] =
	                    this.scriptTagHolder.uniqueCallbackIdentifier;
	            }
	            urlParams[VERSION_PARAM] = PROTOCOL_VERSION;
	            if (this.transportSessionId) {
	                urlParams[TRANSPORT_SESSION_PARAM] = this.transportSessionId;
	            }
	            if (this.lastSessionId) {
	                urlParams[LAST_SESSION_PARAM] = this.lastSessionId;
	            }
	            if (this.applicationId) {
	                urlParams[APPLICATION_ID_PARAM] = this.applicationId;
	            }
	            if (this.appCheckToken) {
	                urlParams[APP_CHECK_TOKEN_PARAM] = this.appCheckToken;
	            }
	            if (typeof location !== 'undefined' &&
	                location.hostname &&
	                FORGE_DOMAIN_RE.test(location.hostname)) {
	                urlParams[REFERER_PARAM] = FORGE_REF;
	            }
	            const connectURL = this.urlFn(urlParams);
	            this.log_('Connecting via long-poll to ' + connectURL);
	            this.scriptTagHolder.addTag(connectURL, () => {
	                /* do nothing */
	            });
	        });
	    }
	    /**
	     * Call this when a handshake has completed successfully and we want to consider the connection established
	     */
	    start() {
	        this.scriptTagHolder.startLongPoll(this.id, this.password);
	        this.addDisconnectPingFrame(this.id, this.password);
	    }
	    /**
	     * Forces long polling to be considered as a potential transport
	     */
	    static forceAllow() {
	        BrowserPollConnection.forceAllow_ = true;
	    }
	    /**
	     * Forces longpolling to not be considered as a potential transport
	     */
	    static forceDisallow() {
	        BrowserPollConnection.forceDisallow_ = true;
	    }
	    // Static method, use string literal so it can be accessed in a generic way
	    static isAvailable() {
	        if (BrowserPollConnection.forceAllow_) {
	            return true;
	        }
	        else {
	            // NOTE: In React-Native there's normally no 'document', but if you debug a React-Native app in
	            // the Chrome debugger, 'document' is defined, but document.createElement is null (2015/06/08).
	            return (!BrowserPollConnection.forceDisallow_ &&
	                typeof document !== 'undefined' &&
	                document.createElement != null &&
	                !isChromeExtensionContentScript() &&
	                !isWindowsStoreApp());
	        }
	    }
	    /**
	     * No-op for polling
	     */
	    markConnectionHealthy() { }
	    /**
	     * Stops polling and cleans up the iframe
	     */
	    shutdown_() {
	        this.isClosed_ = true;
	        if (this.scriptTagHolder) {
	            this.scriptTagHolder.close();
	            this.scriptTagHolder = null;
	        }
	        //remove the disconnect frame, which will trigger an XHR call to the server to tell it we're leaving.
	        if (this.myDisconnFrame) {
	            document.body.removeChild(this.myDisconnFrame);
	            this.myDisconnFrame = null;
	        }
	        if (this.connectTimeoutTimer_) {
	            clearTimeout(this.connectTimeoutTimer_);
	            this.connectTimeoutTimer_ = null;
	        }
	    }
	    /**
	     * Triggered when this transport is closed
	     */
	    onClosed_() {
	        if (!this.isClosed_) {
	            this.log_('Longpoll is closing itself');
	            this.shutdown_();
	            if (this.onDisconnect_) {
	                this.onDisconnect_(this.everConnected_);
	                this.onDisconnect_ = null;
	            }
	        }
	    }
	    /**
	     * External-facing close handler. RealTime has requested we shut down. Kill our connection and tell the server
	     * that we've left.
	     */
	    close() {
	        if (!this.isClosed_) {
	            this.log_('Longpoll is being closed.');
	            this.shutdown_();
	        }
	    }
	    /**
	     * Send the JSON object down to the server. It will need to be stringified, base64 encoded, and then
	     * broken into chunks (since URLs have a small maximum length).
	     * @param data - The JSON data to transmit.
	     */
	    send(data) {
	        const dataStr = stringify(data);
	        this.bytesSent += dataStr.length;
	        this.stats_.incrementCounter('bytes_sent', dataStr.length);
	        //first, lets get the base64-encoded data
	        const base64data = base64Encode(dataStr);
	        //We can only fit a certain amount in each URL, so we need to split this request
	        //up into multiple pieces if it doesn't fit in one request.
	        const dataSegs = splitStringBySize(base64data, MAX_PAYLOAD_SIZE);
	        //Enqueue each segment for transmission. We assign each chunk a sequential ID and a total number
	        //of segments so that we can reassemble the packet on the server.
	        for (let i = 0; i < dataSegs.length; i++) {
	            this.scriptTagHolder.enqueueSegment(this.curSegmentNum, dataSegs.length, dataSegs[i]);
	            this.curSegmentNum++;
	        }
	    }
	    /**
	     * This is how we notify the server that we're leaving.
	     * We aren't able to send requests with DHTML on a window close event, but we can
	     * trigger XHR requests in some browsers (everything but Opera basically).
	     */
	    addDisconnectPingFrame(id, pw) {
	        this.myDisconnFrame = document.createElement('iframe');
	        const urlParams = {};
	        urlParams[FIREBASE_LONGPOLL_DISCONN_FRAME_REQUEST_PARAM] = 't';
	        urlParams[FIREBASE_LONGPOLL_ID_PARAM] = id;
	        urlParams[FIREBASE_LONGPOLL_PW_PARAM] = pw;
	        this.myDisconnFrame.src = this.urlFn(urlParams);
	        this.myDisconnFrame.style.display = 'none';
	        document.body.appendChild(this.myDisconnFrame);
	    }
	    /**
	     * Used to track the bytes received by this client
	     */
	    incrementIncomingBytes_(args) {
	        // TODO: This is an annoying perf hit just to track the number of incoming bytes.  Maybe it should be opt-in.
	        const bytesReceived = stringify(args).length;
	        this.bytesReceived += bytesReceived;
	        this.stats_.incrementCounter('bytes_received', bytesReceived);
	    }
	}
	/*********************************************************************************************
	 * A wrapper around an iframe that is used as a long-polling script holder.
	 *********************************************************************************************/
	class FirebaseIFrameScriptHolder {
	    /**
	     * @param commandCB - The callback to be called when control commands are received from the server.
	     * @param onMessageCB - The callback to be triggered when responses arrive from the server.
	     * @param onDisconnect - The callback to be triggered when this tag holder is closed
	     * @param urlFn - A function that provides the URL of the endpoint to send data to.
	     */
	    constructor(commandCB, onMessageCB, onDisconnect, urlFn) {
	        this.onDisconnect = onDisconnect;
	        this.urlFn = urlFn;
	        //We maintain a count of all of the outstanding requests, because if we have too many active at once it can cause
	        //problems in some browsers.
	        this.outstandingRequests = new Set();
	        //A queue of the pending segments waiting for transmission to the server.
	        this.pendingSegs = [];
	        //A serial number. We use this for two things:
	        // 1) A way to ensure the browser doesn't cache responses to polls
	        // 2) A way to make the server aware when long-polls arrive in a different order than we started them. The
	        //    server needs to release both polls in this case or it will cause problems in Opera since Opera can only execute
	        //    JSONP code in the order it was added to the iframe.
	        this.currentSerial = Math.floor(Math.random() * 100000000);
	        // This gets set to false when we're "closing down" the connection (e.g. we're switching transports but there's still
	        // incoming data from the server that we're waiting for).
	        this.sendNewPolls = true;
	        {
	            //Each script holder registers a couple of uniquely named callbacks with the window. These are called from the
	            //iframes where we put the long-polling script tags. We have two callbacks:
	            //   1) Command Callback - Triggered for control issues, like starting a connection.
	            //   2) Message Callback - Triggered when new data arrives.
	            this.uniqueCallbackIdentifier = LUIDGenerator();
	            window[FIREBASE_LONGPOLL_COMMAND_CB_NAME + this.uniqueCallbackIdentifier] = commandCB;
	            window[FIREBASE_LONGPOLL_DATA_CB_NAME + this.uniqueCallbackIdentifier] =
	                onMessageCB;
	            //Create an iframe for us to add script tags to.
	            this.myIFrame = FirebaseIFrameScriptHolder.createIFrame_();
	            // Set the iframe's contents.
	            let script = '';
	            // if we set a javascript url, it's IE and we need to set the document domain. The javascript url is sufficient
	            // for ie9, but ie8 needs to do it again in the document itself.
	            if (this.myIFrame.src &&
	                this.myIFrame.src.substr(0, 'javascript:'.length) === 'javascript:') {
	                const currentDomain = document.domain;
	                script = '<script>document.domain="' + currentDomain + '";</script>';
	            }
	            const iframeContents = '<html><body>' + script + '</body></html>';
	            try {
	                this.myIFrame.doc.open();
	                this.myIFrame.doc.write(iframeContents);
	                this.myIFrame.doc.close();
	            }
	            catch (e) {
	                log('frame writing exception');
	                if (e.stack) {
	                    log(e.stack);
	                }
	                log(e);
	            }
	        }
	    }
	    /**
	     * Each browser has its own funny way to handle iframes. Here we mush them all together into one object that I can
	     * actually use.
	     */
	    static createIFrame_() {
	        const iframe = document.createElement('iframe');
	        iframe.style.display = 'none';
	        // This is necessary in order to initialize the document inside the iframe
	        if (document.body) {
	            document.body.appendChild(iframe);
	            try {
	                // If document.domain has been modified in IE, this will throw an error, and we need to set the
	                // domain of the iframe's document manually. We can do this via a javascript: url as the src attribute
	                // Also note that we must do this *after* the iframe has been appended to the page. Otherwise it doesn't work.
	                const a = iframe.contentWindow.document;
	                if (!a) {
	                    // Apologies for the log-spam, I need to do something to keep closure from optimizing out the assignment above.
	                    log('No IE domain setting required');
	                }
	            }
	            catch (e) {
	                const domain = document.domain;
	                iframe.src =
	                    "javascript:void((function(){document.open();document.domain='" +
	                        domain +
	                        "';document.close();})())";
	            }
	        }
	        else {
	            // LongPollConnection attempts to delay initialization until the document is ready, so hopefully this
	            // never gets hit.
	            throw 'Document body has not initialized. Wait to initialize Firebase until after the document is ready.';
	        }
	        // Get the document of the iframe in a browser-specific way.
	        if (iframe.contentDocument) {
	            iframe.doc = iframe.contentDocument; // Firefox, Opera, Safari
	        }
	        else if (iframe.contentWindow) {
	            iframe.doc = iframe.contentWindow.document; // Internet Explorer
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        }
	        else if (iframe.document) {
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	            iframe.doc = iframe.document; //others?
	        }
	        return iframe;
	    }
	    /**
	     * Cancel all outstanding queries and remove the frame.
	     */
	    close() {
	        //Mark this iframe as dead, so no new requests are sent.
	        this.alive = false;
	        if (this.myIFrame) {
	            //We have to actually remove all of the html inside this iframe before removing it from the
	            //window, or IE will continue loading and executing the script tags we've already added, which
	            //can lead to some errors being thrown. Setting textContent seems to be the safest way to do this.
	            this.myIFrame.doc.body.textContent = '';
	            setTimeout(() => {
	                if (this.myIFrame !== null) {
	                    document.body.removeChild(this.myIFrame);
	                    this.myIFrame = null;
	                }
	            }, Math.floor(0));
	        }
	        // Protect from being called recursively.
	        const onDisconnect = this.onDisconnect;
	        if (onDisconnect) {
	            this.onDisconnect = null;
	            onDisconnect();
	        }
	    }
	    /**
	     * Actually start the long-polling session by adding the first script tag(s) to the iframe.
	     * @param id - The ID of this connection
	     * @param pw - The password for this connection
	     */
	    startLongPoll(id, pw) {
	        this.myID = id;
	        this.myPW = pw;
	        this.alive = true;
	        //send the initial request. If there are requests queued, make sure that we transmit as many as we are currently able to.
	        while (this.newRequest_()) { }
	    }
	    /**
	     * This is called any time someone might want a script tag to be added. It adds a script tag when there aren't
	     * too many outstanding requests and we are still alive.
	     *
	     * If there are outstanding packet segments to send, it sends one. If there aren't, it sends a long-poll anyways if
	     * needed.
	     */
	    newRequest_() {
	        // We keep one outstanding request open all the time to receive data, but if we need to send data
	        // (pendingSegs.length > 0) then we create a new request to send the data.  The server will automatically
	        // close the old request.
	        if (this.alive &&
	            this.sendNewPolls &&
	            this.outstandingRequests.size < (this.pendingSegs.length > 0 ? 2 : 1)) {
	            //construct our url
	            this.currentSerial++;
	            const urlParams = {};
	            urlParams[FIREBASE_LONGPOLL_ID_PARAM] = this.myID;
	            urlParams[FIREBASE_LONGPOLL_PW_PARAM] = this.myPW;
	            urlParams[FIREBASE_LONGPOLL_SERIAL_PARAM] = this.currentSerial;
	            let theURL = this.urlFn(urlParams);
	            //Now add as much data as we can.
	            let curDataString = '';
	            let i = 0;
	            while (this.pendingSegs.length > 0) {
	                //first, lets see if the next segment will fit.
	                const nextSeg = this.pendingSegs[0];
	                if (nextSeg.d.length +
	                    SEG_HEADER_SIZE +
	                    curDataString.length <=
	                    MAX_URL_DATA_SIZE) {
	                    //great, the segment will fit. Lets append it.
	                    const theSeg = this.pendingSegs.shift();
	                    curDataString =
	                        curDataString +
	                            '&' +
	                            FIREBASE_LONGPOLL_SEGMENT_NUM_PARAM +
	                            i +
	                            '=' +
	                            theSeg.seg +
	                            '&' +
	                            FIREBASE_LONGPOLL_SEGMENTS_IN_PACKET +
	                            i +
	                            '=' +
	                            theSeg.ts +
	                            '&' +
	                            FIREBASE_LONGPOLL_DATA_PARAM +
	                            i +
	                            '=' +
	                            theSeg.d;
	                    i++;
	                }
	                else {
	                    break;
	                }
	            }
	            theURL = theURL + curDataString;
	            this.addLongPollTag_(theURL, this.currentSerial);
	            return true;
	        }
	        else {
	            return false;
	        }
	    }
	    /**
	     * Queue a packet for transmission to the server.
	     * @param segnum - A sequential id for this packet segment used for reassembly
	     * @param totalsegs - The total number of segments in this packet
	     * @param data - The data for this segment.
	     */
	    enqueueSegment(segnum, totalsegs, data) {
	        //add this to the queue of segments to send.
	        this.pendingSegs.push({ seg: segnum, ts: totalsegs, d: data });
	        //send the data immediately if there isn't already data being transmitted, unless
	        //startLongPoll hasn't been called yet.
	        if (this.alive) {
	            this.newRequest_();
	        }
	    }
	    /**
	     * Add a script tag for a regular long-poll request.
	     * @param url - The URL of the script tag.
	     * @param serial - The serial number of the request.
	     */
	    addLongPollTag_(url, serial) {
	        //remember that we sent this request.
	        this.outstandingRequests.add(serial);
	        const doNewRequest = () => {
	            this.outstandingRequests.delete(serial);
	            this.newRequest_();
	        };
	        // If this request doesn't return on its own accord (by the server sending us some data), we'll
	        // create a new one after the KEEPALIVE interval to make sure we always keep a fresh request open.
	        const keepaliveTimeout = setTimeout(doNewRequest, Math.floor(KEEPALIVE_REQUEST_INTERVAL));
	        const readyStateCB = () => {
	            // Request completed.  Cancel the keepalive.
	            clearTimeout(keepaliveTimeout);
	            // Trigger a new request so we can continue receiving data.
	            doNewRequest();
	        };
	        this.addTag(url, readyStateCB);
	    }
	    /**
	     * Add an arbitrary script tag to the iframe.
	     * @param url - The URL for the script tag source.
	     * @param loadCB - A callback to be triggered once the script has loaded.
	     */
	    addTag(url, loadCB) {
	        {
	            setTimeout(() => {
	                try {
	                    // if we're already closed, don't add this poll
	                    if (!this.sendNewPolls) {
	                        return;
	                    }
	                    const newScript = this.myIFrame.doc.createElement('script');
	                    newScript.type = 'text/javascript';
	                    newScript.async = true;
	                    newScript.src = url;
	                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	                    newScript.onload = newScript.onreadystatechange =
	                        function () {
	                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	                            const rstate = newScript.readyState;
	                            if (!rstate || rstate === 'loaded' || rstate === 'complete') {
	                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
	                                newScript.onload = newScript.onreadystatechange = null;
	                                if (newScript.parentNode) {
	                                    newScript.parentNode.removeChild(newScript);
	                                }
	                                loadCB();
	                            }
	                        };
	                    newScript.onerror = () => {
	                        log('Long-poll script failed to load: ' + url);
	                        this.sendNewPolls = false;
	                        this.close();
	                    };
	                    this.myIFrame.doc.body.appendChild(newScript);
	                }
	                catch (e) {
	                    // TODO: we should make this error visible somehow
	                }
	            }, Math.floor(1));
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const WEBSOCKET_MAX_FRAME_SIZE = 16384;
	const WEBSOCKET_KEEPALIVE_INTERVAL = 45000;
	let WebSocketImpl = null;
	if (typeof MozWebSocket !== 'undefined') {
	    WebSocketImpl = MozWebSocket;
	}
	else if (typeof WebSocket !== 'undefined') {
	    WebSocketImpl = WebSocket;
	}
	/**
	 * Create a new websocket connection with the given callbacks.
	 */
	class WebSocketConnection {
	    /**
	     * @param connId identifier for this transport
	     * @param repoInfo The info for the websocket endpoint.
	     * @param applicationId The Firebase App ID for this project.
	     * @param appCheckToken The App Check Token for this client.
	     * @param authToken The Auth Token for this client.
	     * @param transportSessionId Optional transportSessionId if this is connecting
	     * to an existing transport session
	     * @param lastSessionId Optional lastSessionId if there was a previous
	     * connection
	     */
	    constructor(connId, repoInfo, applicationId, appCheckToken, authToken, transportSessionId, lastSessionId) {
	        this.connId = connId;
	        this.applicationId = applicationId;
	        this.appCheckToken = appCheckToken;
	        this.authToken = authToken;
	        this.keepaliveTimer = null;
	        this.frames = null;
	        this.totalFrames = 0;
	        this.bytesSent = 0;
	        this.bytesReceived = 0;
	        this.log_ = logWrapper(this.connId);
	        this.stats_ = statsManagerGetCollection(repoInfo);
	        this.connURL = WebSocketConnection.connectionURL_(repoInfo, transportSessionId, lastSessionId, appCheckToken, applicationId);
	        this.nodeAdmin = repoInfo.nodeAdmin;
	    }
	    /**
	     * @param repoInfo - The info for the websocket endpoint.
	     * @param transportSessionId - Optional transportSessionId if this is connecting to an existing transport
	     *                                         session
	     * @param lastSessionId - Optional lastSessionId if there was a previous connection
	     * @returns connection url
	     */
	    static connectionURL_(repoInfo, transportSessionId, lastSessionId, appCheckToken, applicationId) {
	        const urlParams = {};
	        urlParams[VERSION_PARAM] = PROTOCOL_VERSION;
	        if (typeof location !== 'undefined' &&
	            location.hostname &&
	            FORGE_DOMAIN_RE.test(location.hostname)) {
	            urlParams[REFERER_PARAM] = FORGE_REF;
	        }
	        if (transportSessionId) {
	            urlParams[TRANSPORT_SESSION_PARAM] = transportSessionId;
	        }
	        if (lastSessionId) {
	            urlParams[LAST_SESSION_PARAM] = lastSessionId;
	        }
	        if (appCheckToken) {
	            urlParams[APP_CHECK_TOKEN_PARAM] = appCheckToken;
	        }
	        if (applicationId) {
	            urlParams[APPLICATION_ID_PARAM] = applicationId;
	        }
	        return repoInfoConnectionURL(repoInfo, WEBSOCKET, urlParams);
	    }
	    /**
	     * @param onMessage - Callback when messages arrive
	     * @param onDisconnect - Callback with connection lost.
	     */
	    open(onMessage, onDisconnect) {
	        this.onDisconnect = onDisconnect;
	        this.onMessage = onMessage;
	        this.log_('Websocket connecting to ' + this.connURL);
	        this.everConnected_ = false;
	        // Assume failure until proven otherwise.
	        PersistentStorage.set('previous_websocket_failure', true);
	        try {
	            let options;
	            if (isNodeSdk()) ;
	            this.mySock = new WebSocketImpl(this.connURL, [], options);
	        }
	        catch (e) {
	            this.log_('Error instantiating WebSocket.');
	            const error = e.message || e.data;
	            if (error) {
	                this.log_(error);
	            }
	            this.onClosed_();
	            return;
	        }
	        this.mySock.onopen = () => {
	            this.log_('Websocket connected.');
	            this.everConnected_ = true;
	        };
	        this.mySock.onclose = () => {
	            this.log_('Websocket connection was disconnected.');
	            this.mySock = null;
	            this.onClosed_();
	        };
	        this.mySock.onmessage = m => {
	            this.handleIncomingFrame(m);
	        };
	        this.mySock.onerror = e => {
	            this.log_('WebSocket error.  Closing connection.');
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	            const error = e.message || e.data;
	            if (error) {
	                this.log_(error);
	            }
	            this.onClosed_();
	        };
	    }
	    /**
	     * No-op for websockets, we don't need to do anything once the connection is confirmed as open
	     */
	    start() { }
	    static forceDisallow() {
	        WebSocketConnection.forceDisallow_ = true;
	    }
	    static isAvailable() {
	        let isOldAndroid = false;
	        if (typeof navigator !== 'undefined' && navigator.userAgent) {
	            const oldAndroidRegex = /Android ([0-9]{0,}\.[0-9]{0,})/;
	            const oldAndroidMatch = navigator.userAgent.match(oldAndroidRegex);
	            if (oldAndroidMatch && oldAndroidMatch.length > 1) {
	                if (parseFloat(oldAndroidMatch[1]) < 4.4) {
	                    isOldAndroid = true;
	                }
	            }
	        }
	        return (!isOldAndroid &&
	            WebSocketImpl !== null &&
	            !WebSocketConnection.forceDisallow_);
	    }
	    /**
	     * Returns true if we previously failed to connect with this transport.
	     */
	    static previouslyFailed() {
	        // If our persistent storage is actually only in-memory storage,
	        // we default to assuming that it previously failed to be safe.
	        return (PersistentStorage.isInMemoryStorage ||
	            PersistentStorage.get('previous_websocket_failure') === true);
	    }
	    markConnectionHealthy() {
	        PersistentStorage.remove('previous_websocket_failure');
	    }
	    appendFrame_(data) {
	        this.frames.push(data);
	        if (this.frames.length === this.totalFrames) {
	            const fullMess = this.frames.join('');
	            this.frames = null;
	            const jsonMess = jsonEval(fullMess);
	            //handle the message
	            this.onMessage(jsonMess);
	        }
	    }
	    /**
	     * @param frameCount - The number of frames we are expecting from the server
	     */
	    handleNewFrameCount_(frameCount) {
	        this.totalFrames = frameCount;
	        this.frames = [];
	    }
	    /**
	     * Attempts to parse a frame count out of some text. If it can't, assumes a value of 1
	     * @returns Any remaining data to be process, or null if there is none
	     */
	    extractFrameCount_(data) {
	        assert(this.frames === null, 'We already have a frame buffer');
	        // TODO: The server is only supposed to send up to 9999 frames (i.e. length <= 4), but that isn't being enforced
	        // currently.  So allowing larger frame counts (length <= 6).  See https://app.asana.com/0/search/8688598998380/8237608042508
	        if (data.length <= 6) {
	            const frameCount = Number(data);
	            if (!isNaN(frameCount)) {
	                this.handleNewFrameCount_(frameCount);
	                return null;
	            }
	        }
	        this.handleNewFrameCount_(1);
	        return data;
	    }
	    /**
	     * Process a websocket frame that has arrived from the server.
	     * @param mess - The frame data
	     */
	    handleIncomingFrame(mess) {
	        if (this.mySock === null) {
	            return; // Chrome apparently delivers incoming packets even after we .close() the connection sometimes.
	        }
	        const data = mess['data'];
	        this.bytesReceived += data.length;
	        this.stats_.incrementCounter('bytes_received', data.length);
	        this.resetKeepAlive();
	        if (this.frames !== null) {
	            // we're buffering
	            this.appendFrame_(data);
	        }
	        else {
	            // try to parse out a frame count, otherwise, assume 1 and process it
	            const remainingData = this.extractFrameCount_(data);
	            if (remainingData !== null) {
	                this.appendFrame_(remainingData);
	            }
	        }
	    }
	    /**
	     * Send a message to the server
	     * @param data - The JSON object to transmit
	     */
	    send(data) {
	        this.resetKeepAlive();
	        const dataStr = stringify(data);
	        this.bytesSent += dataStr.length;
	        this.stats_.incrementCounter('bytes_sent', dataStr.length);
	        //We can only fit a certain amount in each websocket frame, so we need to split this request
	        //up into multiple pieces if it doesn't fit in one request.
	        const dataSegs = splitStringBySize(dataStr, WEBSOCKET_MAX_FRAME_SIZE);
	        //Send the length header
	        if (dataSegs.length > 1) {
	            this.sendString_(String(dataSegs.length));
	        }
	        //Send the actual data in segments.
	        for (let i = 0; i < dataSegs.length; i++) {
	            this.sendString_(dataSegs[i]);
	        }
	    }
	    shutdown_() {
	        this.isClosed_ = true;
	        if (this.keepaliveTimer) {
	            clearInterval(this.keepaliveTimer);
	            this.keepaliveTimer = null;
	        }
	        if (this.mySock) {
	            this.mySock.close();
	            this.mySock = null;
	        }
	    }
	    onClosed_() {
	        if (!this.isClosed_) {
	            this.log_('WebSocket is closing itself');
	            this.shutdown_();
	            // since this is an internal close, trigger the close listener
	            if (this.onDisconnect) {
	                this.onDisconnect(this.everConnected_);
	                this.onDisconnect = null;
	            }
	        }
	    }
	    /**
	     * External-facing close handler.
	     * Close the websocket and kill the connection.
	     */
	    close() {
	        if (!this.isClosed_) {
	            this.log_('WebSocket is being closed');
	            this.shutdown_();
	        }
	    }
	    /**
	     * Kill the current keepalive timer and start a new one, to ensure that it always fires N seconds after
	     * the last activity.
	     */
	    resetKeepAlive() {
	        clearInterval(this.keepaliveTimer);
	        this.keepaliveTimer = setInterval(() => {
	            //If there has been no websocket activity for a while, send a no-op
	            if (this.mySock) {
	                this.sendString_('0');
	            }
	            this.resetKeepAlive();
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        }, Math.floor(WEBSOCKET_KEEPALIVE_INTERVAL));
	    }
	    /**
	     * Send a string over the websocket.
	     *
	     * @param str - String to send.
	     */
	    sendString_(str) {
	        // Firefox seems to sometimes throw exceptions (NS_ERROR_UNEXPECTED) from websocket .send()
	        // calls for some unknown reason.  We treat these as an error and disconnect.
	        // See https://app.asana.com/0/58926111402292/68021340250410
	        try {
	            this.mySock.send(str);
	        }
	        catch (e) {
	            this.log_('Exception thrown from WebSocket.send():', e.message || e.data, 'Closing connection.');
	            setTimeout(this.onClosed_.bind(this), 0);
	        }
	    }
	}
	/**
	 * Number of response before we consider the connection "healthy."
	 */
	WebSocketConnection.responsesRequiredToBeHealthy = 2;
	/**
	 * Time to wait for the connection te become healthy before giving up.
	 */
	WebSocketConnection.healthyTimeout = 30000;

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Currently simplistic, this class manages what transport a Connection should use at various stages of its
	 * lifecycle.
	 *
	 * It starts with longpolling in a browser, and httppolling on node. It then upgrades to websockets if
	 * they are available.
	 */
	class TransportManager {
	    /**
	     * @param repoInfo - Metadata around the namespace we're connecting to
	     */
	    constructor(repoInfo) {
	        this.initTransports_(repoInfo);
	    }
	    static get ALL_TRANSPORTS() {
	        return [BrowserPollConnection, WebSocketConnection];
	    }
	    /**
	     * Returns whether transport has been selected to ensure WebSocketConnection or BrowserPollConnection are not called after
	     * TransportManager has already set up transports_
	     */
	    static get IS_TRANSPORT_INITIALIZED() {
	        return this.globalTransportInitialized_;
	    }
	    initTransports_(repoInfo) {
	        const isWebSocketsAvailable = WebSocketConnection && WebSocketConnection['isAvailable']();
	        let isSkipPollConnection = isWebSocketsAvailable && !WebSocketConnection.previouslyFailed();
	        if (repoInfo.webSocketOnly) {
	            if (!isWebSocketsAvailable) {
	                warn("wss:// URL used, but browser isn't known to support websockets.  Trying anyway.");
	            }
	            isSkipPollConnection = true;
	        }
	        if (isSkipPollConnection) {
	            this.transports_ = [WebSocketConnection];
	        }
	        else {
	            const transports = (this.transports_ = []);
	            for (const transport of TransportManager.ALL_TRANSPORTS) {
	                if (transport && transport['isAvailable']()) {
	                    transports.push(transport);
	                }
	            }
	            TransportManager.globalTransportInitialized_ = true;
	        }
	    }
	    /**
	     * @returns The constructor for the initial transport to use
	     */
	    initialTransport() {
	        if (this.transports_.length > 0) {
	            return this.transports_[0];
	        }
	        else {
	            throw new Error('No transports available');
	        }
	    }
	    /**
	     * @returns The constructor for the next transport, or null
	     */
	    upgradeTransport() {
	        if (this.transports_.length > 1) {
	            return this.transports_[1];
	        }
	        else {
	            return null;
	        }
	    }
	}
	// Keeps track of whether the TransportManager has already chosen a transport to use
	TransportManager.globalTransportInitialized_ = false;

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	// Abort upgrade attempt if it takes longer than 60s.
	const UPGRADE_TIMEOUT = 60000;
	// For some transports (WebSockets), we need to "validate" the transport by exchanging a few requests and responses.
	// If we haven't sent enough requests within 5s, we'll start sending noop ping requests.
	const DELAY_BEFORE_SENDING_EXTRA_REQUESTS = 5000;
	// If the initial data sent triggers a lot of bandwidth (i.e. it's a large put or a listen for a large amount of data)
	// then we may not be able to exchange our ping/pong requests within the healthy timeout.  So if we reach the timeout
	// but we've sent/received enough bytes, we don't cancel the connection.
	const BYTES_SENT_HEALTHY_OVERRIDE = 10 * 1024;
	const BYTES_RECEIVED_HEALTHY_OVERRIDE = 100 * 1024;
	const MESSAGE_TYPE = 't';
	const MESSAGE_DATA = 'd';
	const CONTROL_SHUTDOWN = 's';
	const CONTROL_RESET = 'r';
	const CONTROL_ERROR = 'e';
	const CONTROL_PONG = 'o';
	const SWITCH_ACK = 'a';
	const END_TRANSMISSION = 'n';
	const PING = 'p';
	const SERVER_HELLO = 'h';
	/**
	 * Creates a new real-time connection to the server using whichever method works
	 * best in the current browser.
	 */
	class Connection {
	    /**
	     * @param id - an id for this connection
	     * @param repoInfo_ - the info for the endpoint to connect to
	     * @param applicationId_ - the Firebase App ID for this project
	     * @param appCheckToken_ - The App Check Token for this device.
	     * @param authToken_ - The auth token for this session.
	     * @param onMessage_ - the callback to be triggered when a server-push message arrives
	     * @param onReady_ - the callback to be triggered when this connection is ready to send messages.
	     * @param onDisconnect_ - the callback to be triggered when a connection was lost
	     * @param onKill_ - the callback to be triggered when this connection has permanently shut down.
	     * @param lastSessionId - last session id in persistent connection. is used to clean up old session in real-time server
	     */
	    constructor(id, repoInfo_, applicationId_, appCheckToken_, authToken_, onMessage_, onReady_, onDisconnect_, onKill_, lastSessionId) {
	        this.id = id;
	        this.repoInfo_ = repoInfo_;
	        this.applicationId_ = applicationId_;
	        this.appCheckToken_ = appCheckToken_;
	        this.authToken_ = authToken_;
	        this.onMessage_ = onMessage_;
	        this.onReady_ = onReady_;
	        this.onDisconnect_ = onDisconnect_;
	        this.onKill_ = onKill_;
	        this.lastSessionId = lastSessionId;
	        this.connectionCount = 0;
	        this.pendingDataMessages = [];
	        this.state_ = 0 /* RealtimeState.CONNECTING */;
	        this.log_ = logWrapper('c:' + this.id + ':');
	        this.transportManager_ = new TransportManager(repoInfo_);
	        this.log_('Connection created');
	        this.start_();
	    }
	    /**
	     * Starts a connection attempt
	     */
	    start_() {
	        const conn = this.transportManager_.initialTransport();
	        this.conn_ = new conn(this.nextTransportId_(), this.repoInfo_, this.applicationId_, this.appCheckToken_, this.authToken_, null, this.lastSessionId);
	        // For certain transports (WebSockets), we need to send and receive several messages back and forth before we
	        // can consider the transport healthy.
	        this.primaryResponsesRequired_ = conn['responsesRequiredToBeHealthy'] || 0;
	        const onMessageReceived = this.connReceiver_(this.conn_);
	        const onConnectionLost = this.disconnReceiver_(this.conn_);
	        this.tx_ = this.conn_;
	        this.rx_ = this.conn_;
	        this.secondaryConn_ = null;
	        this.isHealthy_ = false;
	        /*
	         * Firefox doesn't like when code from one iframe tries to create another iframe by way of the parent frame.
	         * This can occur in the case of a redirect, i.e. we guessed wrong on what server to connect to and received a reset.
	         * Somehow, setTimeout seems to make this ok. That doesn't make sense from a security perspective, since you should
	         * still have the context of your originating frame.
	         */
	        setTimeout(() => {
	            // this.conn_ gets set to null in some of the tests. Check to make sure it still exists before using it
	            this.conn_ && this.conn_.open(onMessageReceived, onConnectionLost);
	        }, Math.floor(0));
	        const healthyTimeoutMS = conn['healthyTimeout'] || 0;
	        if (healthyTimeoutMS > 0) {
	            this.healthyTimeout_ = setTimeoutNonBlocking(() => {
	                this.healthyTimeout_ = null;
	                if (!this.isHealthy_) {
	                    if (this.conn_ &&
	                        this.conn_.bytesReceived > BYTES_RECEIVED_HEALTHY_OVERRIDE) {
	                        this.log_('Connection exceeded healthy timeout but has received ' +
	                            this.conn_.bytesReceived +
	                            ' bytes.  Marking connection healthy.');
	                        this.isHealthy_ = true;
	                        this.conn_.markConnectionHealthy();
	                    }
	                    else if (this.conn_ &&
	                        this.conn_.bytesSent > BYTES_SENT_HEALTHY_OVERRIDE) {
	                        this.log_('Connection exceeded healthy timeout but has sent ' +
	                            this.conn_.bytesSent +
	                            ' bytes.  Leaving connection alive.');
	                        // NOTE: We don't want to mark it healthy, since we have no guarantee that the bytes have made it to
	                        // the server.
	                    }
	                    else {
	                        this.log_('Closing unhealthy connection after timeout.');
	                        this.close();
	                    }
	                }
	                // eslint-disable-next-line @typescript-eslint/no-explicit-any
	            }, Math.floor(healthyTimeoutMS));
	        }
	    }
	    nextTransportId_() {
	        return 'c:' + this.id + ':' + this.connectionCount++;
	    }
	    disconnReceiver_(conn) {
	        return everConnected => {
	            if (conn === this.conn_) {
	                this.onConnectionLost_(everConnected);
	            }
	            else if (conn === this.secondaryConn_) {
	                this.log_('Secondary connection lost.');
	                this.onSecondaryConnectionLost_();
	            }
	            else {
	                this.log_('closing an old connection');
	            }
	        };
	    }
	    connReceiver_(conn) {
	        return (message) => {
	            if (this.state_ !== 2 /* RealtimeState.DISCONNECTED */) {
	                if (conn === this.rx_) {
	                    this.onPrimaryMessageReceived_(message);
	                }
	                else if (conn === this.secondaryConn_) {
	                    this.onSecondaryMessageReceived_(message);
	                }
	                else {
	                    this.log_('message on old connection');
	                }
	            }
	        };
	    }
	    /**
	     * @param dataMsg - An arbitrary data message to be sent to the server
	     */
	    sendRequest(dataMsg) {
	        // wrap in a data message envelope and send it on
	        const msg = { t: 'd', d: dataMsg };
	        this.sendData_(msg);
	    }
	    tryCleanupConnection() {
	        if (this.tx_ === this.secondaryConn_ && this.rx_ === this.secondaryConn_) {
	            this.log_('cleaning up and promoting a connection: ' + this.secondaryConn_.connId);
	            this.conn_ = this.secondaryConn_;
	            this.secondaryConn_ = null;
	            // the server will shutdown the old connection
	        }
	    }
	    onSecondaryControl_(controlData) {
	        if (MESSAGE_TYPE in controlData) {
	            const cmd = controlData[MESSAGE_TYPE];
	            if (cmd === SWITCH_ACK) {
	                this.upgradeIfSecondaryHealthy_();
	            }
	            else if (cmd === CONTROL_RESET) {
	                // Most likely the session wasn't valid. Abandon the switch attempt
	                this.log_('Got a reset on secondary, closing it');
	                this.secondaryConn_.close();
	                // If we were already using this connection for something, than we need to fully close
	                if (this.tx_ === this.secondaryConn_ ||
	                    this.rx_ === this.secondaryConn_) {
	                    this.close();
	                }
	            }
	            else if (cmd === CONTROL_PONG) {
	                this.log_('got pong on secondary.');
	                this.secondaryResponsesRequired_--;
	                this.upgradeIfSecondaryHealthy_();
	            }
	        }
	    }
	    onSecondaryMessageReceived_(parsedData) {
	        const layer = requireKey('t', parsedData);
	        const data = requireKey('d', parsedData);
	        if (layer === 'c') {
	            this.onSecondaryControl_(data);
	        }
	        else if (layer === 'd') {
	            // got a data message, but we're still second connection. Need to buffer it up
	            this.pendingDataMessages.push(data);
	        }
	        else {
	            throw new Error('Unknown protocol layer: ' + layer);
	        }
	    }
	    upgradeIfSecondaryHealthy_() {
	        if (this.secondaryResponsesRequired_ <= 0) {
	            this.log_('Secondary connection is healthy.');
	            this.isHealthy_ = true;
	            this.secondaryConn_.markConnectionHealthy();
	            this.proceedWithUpgrade_();
	        }
	        else {
	            // Send a ping to make sure the connection is healthy.
	            this.log_('sending ping on secondary.');
	            this.secondaryConn_.send({ t: 'c', d: { t: PING, d: {} } });
	        }
	    }
	    proceedWithUpgrade_() {
	        // tell this connection to consider itself open
	        this.secondaryConn_.start();
	        // send ack
	        this.log_('sending client ack on secondary');
	        this.secondaryConn_.send({ t: 'c', d: { t: SWITCH_ACK, d: {} } });
	        // send end packet on primary transport, switch to sending on this one
	        // can receive on this one, buffer responses until end received on primary transport
	        this.log_('Ending transmission on primary');
	        this.conn_.send({ t: 'c', d: { t: END_TRANSMISSION, d: {} } });
	        this.tx_ = this.secondaryConn_;
	        this.tryCleanupConnection();
	    }
	    onPrimaryMessageReceived_(parsedData) {
	        // Must refer to parsedData properties in quotes, so closure doesn't touch them.
	        const layer = requireKey('t', parsedData);
	        const data = requireKey('d', parsedData);
	        if (layer === 'c') {
	            this.onControl_(data);
	        }
	        else if (layer === 'd') {
	            this.onDataMessage_(data);
	        }
	    }
	    onDataMessage_(message) {
	        this.onPrimaryResponse_();
	        // We don't do anything with data messages, just kick them up a level
	        this.onMessage_(message);
	    }
	    onPrimaryResponse_() {
	        if (!this.isHealthy_) {
	            this.primaryResponsesRequired_--;
	            if (this.primaryResponsesRequired_ <= 0) {
	                this.log_('Primary connection is healthy.');
	                this.isHealthy_ = true;
	                this.conn_.markConnectionHealthy();
	            }
	        }
	    }
	    onControl_(controlData) {
	        const cmd = requireKey(MESSAGE_TYPE, controlData);
	        if (MESSAGE_DATA in controlData) {
	            const payload = controlData[MESSAGE_DATA];
	            if (cmd === SERVER_HELLO) {
	                const handshakePayload = Object.assign({}, payload);
	                if (this.repoInfo_.isUsingEmulator) {
	                    // Upon connecting, the emulator will pass the hostname that it's aware of, but we prefer the user's set hostname via `connectDatabaseEmulator` over what the emulator passes.
	                    handshakePayload.h = this.repoInfo_.host;
	                }
	                this.onHandshake_(handshakePayload);
	            }
	            else if (cmd === END_TRANSMISSION) {
	                this.log_('recvd end transmission on primary');
	                this.rx_ = this.secondaryConn_;
	                for (let i = 0; i < this.pendingDataMessages.length; ++i) {
	                    this.onDataMessage_(this.pendingDataMessages[i]);
	                }
	                this.pendingDataMessages = [];
	                this.tryCleanupConnection();
	            }
	            else if (cmd === CONTROL_SHUTDOWN) {
	                // This was previously the 'onKill' callback passed to the lower-level connection
	                // payload in this case is the reason for the shutdown. Generally a human-readable error
	                this.onConnectionShutdown_(payload);
	            }
	            else if (cmd === CONTROL_RESET) {
	                // payload in this case is the host we should contact
	                this.onReset_(payload);
	            }
	            else if (cmd === CONTROL_ERROR) {
	                error('Server Error: ' + payload);
	            }
	            else if (cmd === CONTROL_PONG) {
	                this.log_('got pong on primary.');
	                this.onPrimaryResponse_();
	                this.sendPingOnPrimaryIfNecessary_();
	            }
	            else {
	                error('Unknown control packet command: ' + cmd);
	            }
	        }
	    }
	    /**
	     * @param handshake - The handshake data returned from the server
	     */
	    onHandshake_(handshake) {
	        const timestamp = handshake.ts;
	        const version = handshake.v;
	        const host = handshake.h;
	        this.sessionId = handshake.s;
	        this.repoInfo_.host = host;
	        // if we've already closed the connection, then don't bother trying to progress further
	        if (this.state_ === 0 /* RealtimeState.CONNECTING */) {
	            this.conn_.start();
	            this.onConnectionEstablished_(this.conn_, timestamp);
	            if (PROTOCOL_VERSION !== version) {
	                warn('Protocol version mismatch detected');
	            }
	            // TODO: do we want to upgrade? when? maybe a delay?
	            this.tryStartUpgrade_();
	        }
	    }
	    tryStartUpgrade_() {
	        const conn = this.transportManager_.upgradeTransport();
	        if (conn) {
	            this.startUpgrade_(conn);
	        }
	    }
	    startUpgrade_(conn) {
	        this.secondaryConn_ = new conn(this.nextTransportId_(), this.repoInfo_, this.applicationId_, this.appCheckToken_, this.authToken_, this.sessionId);
	        // For certain transports (WebSockets), we need to send and receive several messages back and forth before we
	        // can consider the transport healthy.
	        this.secondaryResponsesRequired_ =
	            conn['responsesRequiredToBeHealthy'] || 0;
	        const onMessage = this.connReceiver_(this.secondaryConn_);
	        const onDisconnect = this.disconnReceiver_(this.secondaryConn_);
	        this.secondaryConn_.open(onMessage, onDisconnect);
	        // If we haven't successfully upgraded after UPGRADE_TIMEOUT, give up and kill the secondary.
	        setTimeoutNonBlocking(() => {
	            if (this.secondaryConn_) {
	                this.log_('Timed out trying to upgrade.');
	                this.secondaryConn_.close();
	            }
	        }, Math.floor(UPGRADE_TIMEOUT));
	    }
	    onReset_(host) {
	        this.log_('Reset packet received.  New host: ' + host);
	        this.repoInfo_.host = host;
	        // TODO: if we're already "connected", we need to trigger a disconnect at the next layer up.
	        // We don't currently support resets after the connection has already been established
	        if (this.state_ === 1 /* RealtimeState.CONNECTED */) {
	            this.close();
	        }
	        else {
	            // Close whatever connections we have open and start again.
	            this.closeConnections_();
	            this.start_();
	        }
	    }
	    onConnectionEstablished_(conn, timestamp) {
	        this.log_('Realtime connection established.');
	        this.conn_ = conn;
	        this.state_ = 1 /* RealtimeState.CONNECTED */;
	        if (this.onReady_) {
	            this.onReady_(timestamp, this.sessionId);
	            this.onReady_ = null;
	        }
	        // If after 5 seconds we haven't sent enough requests to the server to get the connection healthy,
	        // send some pings.
	        if (this.primaryResponsesRequired_ === 0) {
	            this.log_('Primary connection is healthy.');
	            this.isHealthy_ = true;
	        }
	        else {
	            setTimeoutNonBlocking(() => {
	                this.sendPingOnPrimaryIfNecessary_();
	            }, Math.floor(DELAY_BEFORE_SENDING_EXTRA_REQUESTS));
	        }
	    }
	    sendPingOnPrimaryIfNecessary_() {
	        // If the connection isn't considered healthy yet, we'll send a noop ping packet request.
	        if (!this.isHealthy_ && this.state_ === 1 /* RealtimeState.CONNECTED */) {
	            this.log_('sending ping on primary.');
	            this.sendData_({ t: 'c', d: { t: PING, d: {} } });
	        }
	    }
	    onSecondaryConnectionLost_() {
	        const conn = this.secondaryConn_;
	        this.secondaryConn_ = null;
	        if (this.tx_ === conn || this.rx_ === conn) {
	            // we are relying on this connection already in some capacity. Therefore, a failure is real
	            this.close();
	        }
	    }
	    /**
	     * @param everConnected - Whether or not the connection ever reached a server. Used to determine if
	     * we should flush the host cache
	     */
	    onConnectionLost_(everConnected) {
	        this.conn_ = null;
	        // NOTE: IF you're seeing a Firefox error for this line, I think it might be because it's getting
	        // called on window close and RealtimeState.CONNECTING is no longer defined.  Just a guess.
	        if (!everConnected && this.state_ === 0 /* RealtimeState.CONNECTING */) {
	            this.log_('Realtime connection failed.');
	            // Since we failed to connect at all, clear any cached entry for this namespace in case the machine went away
	            if (this.repoInfo_.isCacheableHost()) {
	                PersistentStorage.remove('host:' + this.repoInfo_.host);
	                // reset the internal host to what we would show the user, i.e. <ns>.firebaseio.com
	                this.repoInfo_.internalHost = this.repoInfo_.host;
	            }
	        }
	        else if (this.state_ === 1 /* RealtimeState.CONNECTED */) {
	            this.log_('Realtime connection lost.');
	        }
	        this.close();
	    }
	    onConnectionShutdown_(reason) {
	        this.log_('Connection shutdown command received. Shutting down...');
	        if (this.onKill_) {
	            this.onKill_(reason);
	            this.onKill_ = null;
	        }
	        // We intentionally don't want to fire onDisconnect (kill is a different case),
	        // so clear the callback.
	        this.onDisconnect_ = null;
	        this.close();
	    }
	    sendData_(data) {
	        if (this.state_ !== 1 /* RealtimeState.CONNECTED */) {
	            throw 'Connection is not connected';
	        }
	        else {
	            this.tx_.send(data);
	        }
	    }
	    /**
	     * Cleans up this connection, calling the appropriate callbacks
	     */
	    close() {
	        if (this.state_ !== 2 /* RealtimeState.DISCONNECTED */) {
	            this.log_('Closing realtime connection.');
	            this.state_ = 2 /* RealtimeState.DISCONNECTED */;
	            this.closeConnections_();
	            if (this.onDisconnect_) {
	                this.onDisconnect_();
	                this.onDisconnect_ = null;
	            }
	        }
	    }
	    closeConnections_() {
	        this.log_('Shutting down all connections');
	        if (this.conn_) {
	            this.conn_.close();
	            this.conn_ = null;
	        }
	        if (this.secondaryConn_) {
	            this.secondaryConn_.close();
	            this.secondaryConn_ = null;
	        }
	        if (this.healthyTimeout_) {
	            clearTimeout(this.healthyTimeout_);
	            this.healthyTimeout_ = null;
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Interface defining the set of actions that can be performed against the Firebase server
	 * (basically corresponds to our wire protocol).
	 *
	 * @interface
	 */
	class ServerActions {
	    put(pathString, data, onComplete, hash) { }
	    merge(pathString, data, onComplete, hash) { }
	    /**
	     * Refreshes the auth token for the current connection.
	     * @param token - The authentication token
	     */
	    refreshAuthToken(token) { }
	    /**
	     * Refreshes the app check token for the current connection.
	     * @param token The app check token
	     */
	    refreshAppCheckToken(token) { }
	    onDisconnectPut(pathString, data, onComplete) { }
	    onDisconnectMerge(pathString, data, onComplete) { }
	    onDisconnectCancel(pathString, onComplete) { }
	    reportStats(stats) { }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Base class to be used if you want to emit events. Call the constructor with
	 * the set of allowed event names.
	 */
	class EventEmitter {
	    constructor(allowedEvents_) {
	        this.allowedEvents_ = allowedEvents_;
	        this.listeners_ = {};
	        assert(Array.isArray(allowedEvents_) && allowedEvents_.length > 0, 'Requires a non-empty array');
	    }
	    /**
	     * To be called by derived classes to trigger events.
	     */
	    trigger(eventType, ...varArgs) {
	        if (Array.isArray(this.listeners_[eventType])) {
	            // Clone the list, since callbacks could add/remove listeners.
	            const listeners = [...this.listeners_[eventType]];
	            for (let i = 0; i < listeners.length; i++) {
	                listeners[i].callback.apply(listeners[i].context, varArgs);
	            }
	        }
	    }
	    on(eventType, callback, context) {
	        this.validateEventType_(eventType);
	        this.listeners_[eventType] = this.listeners_[eventType] || [];
	        this.listeners_[eventType].push({ callback, context });
	        const eventData = this.getInitialEvent(eventType);
	        if (eventData) {
	            callback.apply(context, eventData);
	        }
	    }
	    off(eventType, callback, context) {
	        this.validateEventType_(eventType);
	        const listeners = this.listeners_[eventType] || [];
	        for (let i = 0; i < listeners.length; i++) {
	            if (listeners[i].callback === callback &&
	                (!context || context === listeners[i].context)) {
	                listeners.splice(i, 1);
	                return;
	            }
	        }
	    }
	    validateEventType_(eventType) {
	        assert(this.allowedEvents_.find(et => {
	            return et === eventType;
	        }), 'Unknown event: ' + eventType);
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Monitors online state (as reported by window.online/offline events).
	 *
	 * The expectation is that this could have many false positives (thinks we are online
	 * when we're not), but no false negatives.  So we can safely use it to determine when
	 * we definitely cannot reach the internet.
	 */
	class OnlineMonitor extends EventEmitter {
	    constructor() {
	        super(['online']);
	        this.online_ = true;
	        // We've had repeated complaints that Cordova apps can get stuck "offline", e.g.
	        // https://forum.ionicframework.com/t/firebase-connection-is-lost-and-never-come-back/43810
	        // It would seem that the 'online' event does not always fire consistently. So we disable it
	        // for Cordova.
	        if (typeof window !== 'undefined' &&
	            typeof window.addEventListener !== 'undefined' &&
	            !isMobileCordova()) {
	            window.addEventListener('online', () => {
	                if (!this.online_) {
	                    this.online_ = true;
	                    this.trigger('online', true);
	                }
	            }, false);
	            window.addEventListener('offline', () => {
	                if (this.online_) {
	                    this.online_ = false;
	                    this.trigger('online', false);
	                }
	            }, false);
	        }
	    }
	    static getInstance() {
	        return new OnlineMonitor();
	    }
	    getInitialEvent(eventType) {
	        assert(eventType === 'online', 'Unknown event type: ' + eventType);
	        return [this.online_];
	    }
	    currentlyOnline() {
	        return this.online_;
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/** Maximum key depth. */
	const MAX_PATH_DEPTH = 32;
	/** Maximum number of (UTF8) bytes in a Firebase path. */
	const MAX_PATH_LENGTH_BYTES = 768;
	/**
	 * An immutable object representing a parsed path.  It's immutable so that you
	 * can pass them around to other functions without worrying about them changing
	 * it.
	 */
	class Path {
	    /**
	     * @param pathOrString - Path string to parse, or another path, or the raw
	     * tokens array
	     */
	    constructor(pathOrString, pieceNum) {
	        if (pieceNum === void 0) {
	            this.pieces_ = pathOrString.split('/');
	            // Remove empty pieces.
	            let copyTo = 0;
	            for (let i = 0; i < this.pieces_.length; i++) {
	                if (this.pieces_[i].length > 0) {
	                    this.pieces_[copyTo] = this.pieces_[i];
	                    copyTo++;
	                }
	            }
	            this.pieces_.length = copyTo;
	            this.pieceNum_ = 0;
	        }
	        else {
	            this.pieces_ = pathOrString;
	            this.pieceNum_ = pieceNum;
	        }
	    }
	    toString() {
	        let pathString = '';
	        for (let i = this.pieceNum_; i < this.pieces_.length; i++) {
	            if (this.pieces_[i] !== '') {
	                pathString += '/' + this.pieces_[i];
	            }
	        }
	        return pathString || '/';
	    }
	}
	function newEmptyPath() {
	    return new Path('');
	}
	function pathGetFront(path) {
	    if (path.pieceNum_ >= path.pieces_.length) {
	        return null;
	    }
	    return path.pieces_[path.pieceNum_];
	}
	/**
	 * @returns The number of segments in this path
	 */
	function pathGetLength(path) {
	    return path.pieces_.length - path.pieceNum_;
	}
	function pathPopFront(path) {
	    let pieceNum = path.pieceNum_;
	    if (pieceNum < path.pieces_.length) {
	        pieceNum++;
	    }
	    return new Path(path.pieces_, pieceNum);
	}
	function pathGetBack(path) {
	    if (path.pieceNum_ < path.pieces_.length) {
	        return path.pieces_[path.pieces_.length - 1];
	    }
	    return null;
	}
	function pathToUrlEncodedString(path) {
	    let pathString = '';
	    for (let i = path.pieceNum_; i < path.pieces_.length; i++) {
	        if (path.pieces_[i] !== '') {
	            pathString += '/' + encodeURIComponent(String(path.pieces_[i]));
	        }
	    }
	    return pathString || '/';
	}
	/**
	 * Shallow copy of the parts of the path.
	 *
	 */
	function pathSlice(path, begin = 0) {
	    return path.pieces_.slice(path.pieceNum_ + begin);
	}
	function pathParent(path) {
	    if (path.pieceNum_ >= path.pieces_.length) {
	        return null;
	    }
	    const pieces = [];
	    for (let i = path.pieceNum_; i < path.pieces_.length - 1; i++) {
	        pieces.push(path.pieces_[i]);
	    }
	    return new Path(pieces, 0);
	}
	function pathChild(path, childPathObj) {
	    const pieces = [];
	    for (let i = path.pieceNum_; i < path.pieces_.length; i++) {
	        pieces.push(path.pieces_[i]);
	    }
	    if (childPathObj instanceof Path) {
	        for (let i = childPathObj.pieceNum_; i < childPathObj.pieces_.length; i++) {
	            pieces.push(childPathObj.pieces_[i]);
	        }
	    }
	    else {
	        const childPieces = childPathObj.split('/');
	        for (let i = 0; i < childPieces.length; i++) {
	            if (childPieces[i].length > 0) {
	                pieces.push(childPieces[i]);
	            }
	        }
	    }
	    return new Path(pieces, 0);
	}
	/**
	 * @returns True if there are no segments in this path
	 */
	function pathIsEmpty(path) {
	    return path.pieceNum_ >= path.pieces_.length;
	}
	/**
	 * @returns The path from outerPath to innerPath
	 */
	function newRelativePath(outerPath, innerPath) {
	    const outer = pathGetFront(outerPath), inner = pathGetFront(innerPath);
	    if (outer === null) {
	        return innerPath;
	    }
	    else if (outer === inner) {
	        return newRelativePath(pathPopFront(outerPath), pathPopFront(innerPath));
	    }
	    else {
	        throw new Error('INTERNAL ERROR: innerPath (' +
	            innerPath +
	            ') is not within ' +
	            'outerPath (' +
	            outerPath +
	            ')');
	    }
	}
	/**
	 * @returns true if paths are the same.
	 */
	function pathEquals(path, other) {
	    if (pathGetLength(path) !== pathGetLength(other)) {
	        return false;
	    }
	    for (let i = path.pieceNum_, j = other.pieceNum_; i <= path.pieces_.length; i++, j++) {
	        if (path.pieces_[i] !== other.pieces_[j]) {
	            return false;
	        }
	    }
	    return true;
	}
	/**
	 * @returns True if this path is a parent of (or the same as) other
	 */
	function pathContains(path, other) {
	    let i = path.pieceNum_;
	    let j = other.pieceNum_;
	    if (pathGetLength(path) > pathGetLength(other)) {
	        return false;
	    }
	    while (i < path.pieces_.length) {
	        if (path.pieces_[i] !== other.pieces_[j]) {
	            return false;
	        }
	        ++i;
	        ++j;
	    }
	    return true;
	}
	/**
	 * Dynamic (mutable) path used to count path lengths.
	 *
	 * This class is used to efficiently check paths for valid
	 * length (in UTF8 bytes) and depth (used in path validation).
	 *
	 * Throws Error exception if path is ever invalid.
	 *
	 * The definition of a path always begins with '/'.
	 */
	class ValidationPath {
	    /**
	     * @param path - Initial Path.
	     * @param errorPrefix_ - Prefix for any error messages.
	     */
	    constructor(path, errorPrefix_) {
	        this.errorPrefix_ = errorPrefix_;
	        this.parts_ = pathSlice(path, 0);
	        /** Initialize to number of '/' chars needed in path. */
	        this.byteLength_ = Math.max(1, this.parts_.length);
	        for (let i = 0; i < this.parts_.length; i++) {
	            this.byteLength_ += stringLength(this.parts_[i]);
	        }
	        validationPathCheckValid(this);
	    }
	}
	function validationPathPush(validationPath, child) {
	    // Count the needed '/'
	    if (validationPath.parts_.length > 0) {
	        validationPath.byteLength_ += 1;
	    }
	    validationPath.parts_.push(child);
	    validationPath.byteLength_ += stringLength(child);
	    validationPathCheckValid(validationPath);
	}
	function validationPathPop(validationPath) {
	    const last = validationPath.parts_.pop();
	    validationPath.byteLength_ -= stringLength(last);
	    // Un-count the previous '/'
	    if (validationPath.parts_.length > 0) {
	        validationPath.byteLength_ -= 1;
	    }
	}
	function validationPathCheckValid(validationPath) {
	    if (validationPath.byteLength_ > MAX_PATH_LENGTH_BYTES) {
	        throw new Error(validationPath.errorPrefix_ +
	            'has a key path longer than ' +
	            MAX_PATH_LENGTH_BYTES +
	            ' bytes (' +
	            validationPath.byteLength_ +
	            ').');
	    }
	    if (validationPath.parts_.length > MAX_PATH_DEPTH) {
	        throw new Error(validationPath.errorPrefix_ +
	            'path specified exceeds the maximum depth that can be written (' +
	            MAX_PATH_DEPTH +
	            ') or object contains a cycle ' +
	            validationPathToErrorString(validationPath));
	    }
	}
	/**
	 * String for use in error messages - uses '.' notation for path.
	 */
	function validationPathToErrorString(validationPath) {
	    if (validationPath.parts_.length === 0) {
	        return '';
	    }
	    return "in property '" + validationPath.parts_.join('.') + "'";
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class VisibilityMonitor extends EventEmitter {
	    constructor() {
	        super(['visible']);
	        let hidden;
	        let visibilityChange;
	        if (typeof document !== 'undefined' &&
	            typeof document.addEventListener !== 'undefined') {
	            if (typeof document['hidden'] !== 'undefined') {
	                // Opera 12.10 and Firefox 18 and later support
	                visibilityChange = 'visibilitychange';
	                hidden = 'hidden';
	            }
	            else if (typeof document['mozHidden'] !== 'undefined') {
	                visibilityChange = 'mozvisibilitychange';
	                hidden = 'mozHidden';
	            }
	            else if (typeof document['msHidden'] !== 'undefined') {
	                visibilityChange = 'msvisibilitychange';
	                hidden = 'msHidden';
	            }
	            else if (typeof document['webkitHidden'] !== 'undefined') {
	                visibilityChange = 'webkitvisibilitychange';
	                hidden = 'webkitHidden';
	            }
	        }
	        // Initially, we always assume we are visible. This ensures that in browsers
	        // without page visibility support or in cases where we are never visible
	        // (e.g. chrome extension), we act as if we are visible, i.e. don't delay
	        // reconnects
	        this.visible_ = true;
	        if (visibilityChange) {
	            document.addEventListener(visibilityChange, () => {
	                const visible = !document[hidden];
	                if (visible !== this.visible_) {
	                    this.visible_ = visible;
	                    this.trigger('visible', visible);
	                }
	            }, false);
	        }
	    }
	    static getInstance() {
	        return new VisibilityMonitor();
	    }
	    getInitialEvent(eventType) {
	        assert(eventType === 'visible', 'Unknown event type: ' + eventType);
	        return [this.visible_];
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const RECONNECT_MIN_DELAY = 1000;
	const RECONNECT_MAX_DELAY_DEFAULT = 60 * 5 * 1000; // 5 minutes in milliseconds (Case: 1858)
	const RECONNECT_MAX_DELAY_FOR_ADMINS = 30 * 1000; // 30 seconds for admin clients (likely to be a backend server)
	const RECONNECT_DELAY_MULTIPLIER = 1.3;
	const RECONNECT_DELAY_RESET_TIMEOUT = 30000; // Reset delay back to MIN_DELAY after being connected for 30sec.
	const SERVER_KILL_INTERRUPT_REASON = 'server_kill';
	// If auth fails repeatedly, we'll assume something is wrong and log a warning / back off.
	const INVALID_TOKEN_THRESHOLD = 3;
	/**
	 * Firebase connection.  Abstracts wire protocol and handles reconnecting.
	 *
	 * NOTE: All JSON objects sent to the realtime connection must have property names enclosed
	 * in quotes to make sure the closure compiler does not minify them.
	 */
	class PersistentConnection extends ServerActions {
	    /**
	     * @param repoInfo_ - Data about the namespace we are connecting to
	     * @param applicationId_ - The Firebase App ID for this project
	     * @param onDataUpdate_ - A callback for new data from the server
	     */
	    constructor(repoInfo_, applicationId_, onDataUpdate_, onConnectStatus_, onServerInfoUpdate_, authTokenProvider_, appCheckTokenProvider_, authOverride_) {
	        super();
	        this.repoInfo_ = repoInfo_;
	        this.applicationId_ = applicationId_;
	        this.onDataUpdate_ = onDataUpdate_;
	        this.onConnectStatus_ = onConnectStatus_;
	        this.onServerInfoUpdate_ = onServerInfoUpdate_;
	        this.authTokenProvider_ = authTokenProvider_;
	        this.appCheckTokenProvider_ = appCheckTokenProvider_;
	        this.authOverride_ = authOverride_;
	        // Used for diagnostic logging.
	        this.id = PersistentConnection.nextPersistentConnectionId_++;
	        this.log_ = logWrapper('p:' + this.id + ':');
	        this.interruptReasons_ = {};
	        this.listens = new Map();
	        this.outstandingPuts_ = [];
	        this.outstandingGets_ = [];
	        this.outstandingPutCount_ = 0;
	        this.outstandingGetCount_ = 0;
	        this.onDisconnectRequestQueue_ = [];
	        this.connected_ = false;
	        this.reconnectDelay_ = RECONNECT_MIN_DELAY;
	        this.maxReconnectDelay_ = RECONNECT_MAX_DELAY_DEFAULT;
	        this.securityDebugCallback_ = null;
	        this.lastSessionId = null;
	        this.establishConnectionTimer_ = null;
	        this.visible_ = false;
	        // Before we get connected, we keep a queue of pending messages to send.
	        this.requestCBHash_ = {};
	        this.requestNumber_ = 0;
	        this.realtime_ = null;
	        this.authToken_ = null;
	        this.appCheckToken_ = null;
	        this.forceTokenRefresh_ = false;
	        this.invalidAuthTokenCount_ = 0;
	        this.invalidAppCheckTokenCount_ = 0;
	        this.firstConnection_ = true;
	        this.lastConnectionAttemptTime_ = null;
	        this.lastConnectionEstablishedTime_ = null;
	        if (authOverride_ && !isNodeSdk()) {
	            throw new Error('Auth override specified in options, but not supported on non Node.js platforms');
	        }
	        VisibilityMonitor.getInstance().on('visible', this.onVisible_, this);
	        if (repoInfo_.host.indexOf('fblocal') === -1) {
	            OnlineMonitor.getInstance().on('online', this.onOnline_, this);
	        }
	    }
	    sendRequest(action, body, onResponse) {
	        const curReqNum = ++this.requestNumber_;
	        const msg = { r: curReqNum, a: action, b: body };
	        this.log_(stringify(msg));
	        assert(this.connected_, "sendRequest call when we're not connected not allowed.");
	        this.realtime_.sendRequest(msg);
	        if (onResponse) {
	            this.requestCBHash_[curReqNum] = onResponse;
	        }
	    }
	    get(query) {
	        this.initConnection_();
	        const deferred = new Deferred();
	        const request = {
	            p: query._path.toString(),
	            q: query._queryObject
	        };
	        const outstandingGet = {
	            action: 'g',
	            request,
	            onComplete: (message) => {
	                const payload = message['d'];
	                if (message['s'] === 'ok') {
	                    deferred.resolve(payload);
	                }
	                else {
	                    deferred.reject(payload);
	                }
	            }
	        };
	        this.outstandingGets_.push(outstandingGet);
	        this.outstandingGetCount_++;
	        const index = this.outstandingGets_.length - 1;
	        if (this.connected_) {
	            this.sendGet_(index);
	        }
	        return deferred.promise;
	    }
	    listen(query, currentHashFn, tag, onComplete) {
	        this.initConnection_();
	        const queryId = query._queryIdentifier;
	        const pathString = query._path.toString();
	        this.log_('Listen called for ' + pathString + ' ' + queryId);
	        if (!this.listens.has(pathString)) {
	            this.listens.set(pathString, new Map());
	        }
	        assert(query._queryParams.isDefault() || !query._queryParams.loadsAllData(), 'listen() called for non-default but complete query');
	        assert(!this.listens.get(pathString).has(queryId), `listen() called twice for same path/queryId.`);
	        const listenSpec = {
	            onComplete,
	            hashFn: currentHashFn,
	            query,
	            tag
	        };
	        this.listens.get(pathString).set(queryId, listenSpec);
	        if (this.connected_) {
	            this.sendListen_(listenSpec);
	        }
	    }
	    sendGet_(index) {
	        const get = this.outstandingGets_[index];
	        this.sendRequest('g', get.request, (message) => {
	            delete this.outstandingGets_[index];
	            this.outstandingGetCount_--;
	            if (this.outstandingGetCount_ === 0) {
	                this.outstandingGets_ = [];
	            }
	            if (get.onComplete) {
	                get.onComplete(message);
	            }
	        });
	    }
	    sendListen_(listenSpec) {
	        const query = listenSpec.query;
	        const pathString = query._path.toString();
	        const queryId = query._queryIdentifier;
	        this.log_('Listen on ' + pathString + ' for ' + queryId);
	        const req = { /*path*/ p: pathString };
	        const action = 'q';
	        // Only bother to send query if it's non-default.
	        if (listenSpec.tag) {
	            req['q'] = query._queryObject;
	            req['t'] = listenSpec.tag;
	        }
	        req[ /*hash*/'h'] = listenSpec.hashFn();
	        this.sendRequest(action, req, (message) => {
	            const payload = message[ /*data*/'d'];
	            const status = message[ /*status*/'s'];
	            // print warnings in any case...
	            PersistentConnection.warnOnListenWarnings_(payload, query);
	            const currentListenSpec = this.listens.get(pathString) &&
	                this.listens.get(pathString).get(queryId);
	            // only trigger actions if the listen hasn't been removed and readded
	            if (currentListenSpec === listenSpec) {
	                this.log_('listen response', message);
	                if (status !== 'ok') {
	                    this.removeListen_(pathString, queryId);
	                }
	                if (listenSpec.onComplete) {
	                    listenSpec.onComplete(status, payload);
	                }
	            }
	        });
	    }
	    static warnOnListenWarnings_(payload, query) {
	        if (payload && typeof payload === 'object' && contains(payload, 'w')) {
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	            const warnings = safeGet(payload, 'w');
	            if (Array.isArray(warnings) && ~warnings.indexOf('no_index')) {
	                const indexSpec = '".indexOn": "' + query._queryParams.getIndex().toString() + '"';
	                const indexPath = query._path.toString();
	                warn(`Using an unspecified index. Your data will be downloaded and ` +
	                    `filtered on the client. Consider adding ${indexSpec} at ` +
	                    `${indexPath} to your security rules for better performance.`);
	            }
	        }
	    }
	    refreshAuthToken(token) {
	        this.authToken_ = token;
	        this.log_('Auth token refreshed');
	        if (this.authToken_) {
	            this.tryAuth();
	        }
	        else {
	            //If we're connected we want to let the server know to unauthenticate us. If we're not connected, simply delete
	            //the credential so we dont become authenticated next time we connect.
	            if (this.connected_) {
	                this.sendRequest('unauth', {}, () => { });
	            }
	        }
	        this.reduceReconnectDelayIfAdminCredential_(token);
	    }
	    reduceReconnectDelayIfAdminCredential_(credential) {
	        // NOTE: This isn't intended to be bulletproof (a malicious developer can always just modify the client).
	        // Additionally, we don't bother resetting the max delay back to the default if auth fails / expires.
	        const isFirebaseSecret = credential && credential.length === 40;
	        if (isFirebaseSecret || isAdmin(credential)) {
	            this.log_('Admin auth credential detected.  Reducing max reconnect time.');
	            this.maxReconnectDelay_ = RECONNECT_MAX_DELAY_FOR_ADMINS;
	        }
	    }
	    refreshAppCheckToken(token) {
	        this.appCheckToken_ = token;
	        this.log_('App check token refreshed');
	        if (this.appCheckToken_) {
	            this.tryAppCheck();
	        }
	        else {
	            //If we're connected we want to let the server know to unauthenticate us.
	            //If we're not connected, simply delete the credential so we dont become
	            // authenticated next time we connect.
	            if (this.connected_) {
	                this.sendRequest('unappeck', {}, () => { });
	            }
	        }
	    }
	    /**
	     * Attempts to authenticate with the given credentials. If the authentication attempt fails, it's triggered like
	     * a auth revoked (the connection is closed).
	     */
	    tryAuth() {
	        if (this.connected_ && this.authToken_) {
	            const token = this.authToken_;
	            const authMethod = isValidFormat(token) ? 'auth' : 'gauth';
	            const requestData = { cred: token };
	            if (this.authOverride_ === null) {
	                requestData['noauth'] = true;
	            }
	            else if (typeof this.authOverride_ === 'object') {
	                requestData['authvar'] = this.authOverride_;
	            }
	            this.sendRequest(authMethod, requestData, (res) => {
	                const status = res[ /*status*/'s'];
	                const data = res[ /*data*/'d'] || 'error';
	                if (this.authToken_ === token) {
	                    if (status === 'ok') {
	                        this.invalidAuthTokenCount_ = 0;
	                    }
	                    else {
	                        // Triggers reconnect and force refresh for auth token
	                        this.onAuthRevoked_(status, data);
	                    }
	                }
	            });
	        }
	    }
	    /**
	     * Attempts to authenticate with the given token. If the authentication
	     * attempt fails, it's triggered like the token was revoked (the connection is
	     * closed).
	     */
	    tryAppCheck() {
	        if (this.connected_ && this.appCheckToken_) {
	            this.sendRequest('appcheck', { 'token': this.appCheckToken_ }, (res) => {
	                const status = res[ /*status*/'s'];
	                const data = res[ /*data*/'d'] || 'error';
	                if (status === 'ok') {
	                    this.invalidAppCheckTokenCount_ = 0;
	                }
	                else {
	                    this.onAppCheckRevoked_(status, data);
	                }
	            });
	        }
	    }
	    /**
	     * @inheritDoc
	     */
	    unlisten(query, tag) {
	        const pathString = query._path.toString();
	        const queryId = query._queryIdentifier;
	        this.log_('Unlisten called for ' + pathString + ' ' + queryId);
	        assert(query._queryParams.isDefault() || !query._queryParams.loadsAllData(), 'unlisten() called for non-default but complete query');
	        const listen = this.removeListen_(pathString, queryId);
	        if (listen && this.connected_) {
	            this.sendUnlisten_(pathString, queryId, query._queryObject, tag);
	        }
	    }
	    sendUnlisten_(pathString, queryId, queryObj, tag) {
	        this.log_('Unlisten on ' + pathString + ' for ' + queryId);
	        const req = { /*path*/ p: pathString };
	        const action = 'n';
	        // Only bother sending queryId if it's non-default.
	        if (tag) {
	            req['q'] = queryObj;
	            req['t'] = tag;
	        }
	        this.sendRequest(action, req);
	    }
	    onDisconnectPut(pathString, data, onComplete) {
	        this.initConnection_();
	        if (this.connected_) {
	            this.sendOnDisconnect_('o', pathString, data, onComplete);
	        }
	        else {
	            this.onDisconnectRequestQueue_.push({
	                pathString,
	                action: 'o',
	                data,
	                onComplete
	            });
	        }
	    }
	    onDisconnectMerge(pathString, data, onComplete) {
	        this.initConnection_();
	        if (this.connected_) {
	            this.sendOnDisconnect_('om', pathString, data, onComplete);
	        }
	        else {
	            this.onDisconnectRequestQueue_.push({
	                pathString,
	                action: 'om',
	                data,
	                onComplete
	            });
	        }
	    }
	    onDisconnectCancel(pathString, onComplete) {
	        this.initConnection_();
	        if (this.connected_) {
	            this.sendOnDisconnect_('oc', pathString, null, onComplete);
	        }
	        else {
	            this.onDisconnectRequestQueue_.push({
	                pathString,
	                action: 'oc',
	                data: null,
	                onComplete
	            });
	        }
	    }
	    sendOnDisconnect_(action, pathString, data, onComplete) {
	        const request = { /*path*/ p: pathString, /*data*/ d: data };
	        this.log_('onDisconnect ' + action, request);
	        this.sendRequest(action, request, (response) => {
	            if (onComplete) {
	                setTimeout(() => {
	                    onComplete(response[ /*status*/'s'], response[ /* data */'d']);
	                }, Math.floor(0));
	            }
	        });
	    }
	    put(pathString, data, onComplete, hash) {
	        this.putInternal('p', pathString, data, onComplete, hash);
	    }
	    merge(pathString, data, onComplete, hash) {
	        this.putInternal('m', pathString, data, onComplete, hash);
	    }
	    putInternal(action, pathString, data, onComplete, hash) {
	        this.initConnection_();
	        const request = {
	            /*path*/ p: pathString,
	            /*data*/ d: data
	        };
	        if (hash !== undefined) {
	            request[ /*hash*/'h'] = hash;
	        }
	        // TODO: Only keep track of the most recent put for a given path?
	        this.outstandingPuts_.push({
	            action,
	            request,
	            onComplete
	        });
	        this.outstandingPutCount_++;
	        const index = this.outstandingPuts_.length - 1;
	        if (this.connected_) {
	            this.sendPut_(index);
	        }
	        else {
	            this.log_('Buffering put: ' + pathString);
	        }
	    }
	    sendPut_(index) {
	        const action = this.outstandingPuts_[index].action;
	        const request = this.outstandingPuts_[index].request;
	        const onComplete = this.outstandingPuts_[index].onComplete;
	        this.outstandingPuts_[index].queued = this.connected_;
	        this.sendRequest(action, request, (message) => {
	            this.log_(action + ' response', message);
	            delete this.outstandingPuts_[index];
	            this.outstandingPutCount_--;
	            // Clean up array occasionally.
	            if (this.outstandingPutCount_ === 0) {
	                this.outstandingPuts_ = [];
	            }
	            if (onComplete) {
	                onComplete(message[ /*status*/'s'], message[ /* data */'d']);
	            }
	        });
	    }
	    reportStats(stats) {
	        // If we're not connected, we just drop the stats.
	        if (this.connected_) {
	            const request = { /*counters*/ c: stats };
	            this.log_('reportStats', request);
	            this.sendRequest(/*stats*/ 's', request, result => {
	                const status = result[ /*status*/'s'];
	                if (status !== 'ok') {
	                    const errorReason = result[ /* data */'d'];
	                    this.log_('reportStats', 'Error sending stats: ' + errorReason);
	                }
	            });
	        }
	    }
	    onDataMessage_(message) {
	        if ('r' in message) {
	            // this is a response
	            this.log_('from server: ' + stringify(message));
	            const reqNum = message['r'];
	            const onResponse = this.requestCBHash_[reqNum];
	            if (onResponse) {
	                delete this.requestCBHash_[reqNum];
	                onResponse(message[ /*body*/'b']);
	            }
	        }
	        else if ('error' in message) {
	            throw 'A server-side error has occurred: ' + message['error'];
	        }
	        else if ('a' in message) {
	            // a and b are action and body, respectively
	            this.onDataPush_(message['a'], message['b']);
	        }
	    }
	    onDataPush_(action, body) {
	        this.log_('handleServerMessage', action, body);
	        if (action === 'd') {
	            this.onDataUpdate_(body[ /*path*/'p'], body[ /*data*/'d'], 
	            /*isMerge*/ false, body['t']);
	        }
	        else if (action === 'm') {
	            this.onDataUpdate_(body[ /*path*/'p'], body[ /*data*/'d'], 
	            /*isMerge=*/ true, body['t']);
	        }
	        else if (action === 'c') {
	            this.onListenRevoked_(body[ /*path*/'p'], body[ /*query*/'q']);
	        }
	        else if (action === 'ac') {
	            this.onAuthRevoked_(body[ /*status code*/'s'], body[ /* explanation */'d']);
	        }
	        else if (action === 'apc') {
	            this.onAppCheckRevoked_(body[ /*status code*/'s'], body[ /* explanation */'d']);
	        }
	        else if (action === 'sd') {
	            this.onSecurityDebugPacket_(body);
	        }
	        else {
	            error('Unrecognized action received from server: ' +
	                stringify(action) +
	                '\nAre you using the latest client?');
	        }
	    }
	    onReady_(timestamp, sessionId) {
	        this.log_('connection ready');
	        this.connected_ = true;
	        this.lastConnectionEstablishedTime_ = new Date().getTime();
	        this.handleTimestamp_(timestamp);
	        this.lastSessionId = sessionId;
	        if (this.firstConnection_) {
	            this.sendConnectStats_();
	        }
	        this.restoreState_();
	        this.firstConnection_ = false;
	        this.onConnectStatus_(true);
	    }
	    scheduleConnect_(timeout) {
	        assert(!this.realtime_, "Scheduling a connect when we're already connected/ing?");
	        if (this.establishConnectionTimer_) {
	            clearTimeout(this.establishConnectionTimer_);
	        }
	        // NOTE: Even when timeout is 0, it's important to do a setTimeout to work around an infuriating "Security Error" in
	        // Firefox when trying to write to our long-polling iframe in some scenarios (e.g. Forge or our unit tests).
	        this.establishConnectionTimer_ = setTimeout(() => {
	            this.establishConnectionTimer_ = null;
	            this.establishConnection_();
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        }, Math.floor(timeout));
	    }
	    initConnection_() {
	        if (!this.realtime_ && this.firstConnection_) {
	            this.scheduleConnect_(0);
	        }
	    }
	    onVisible_(visible) {
	        // NOTE: Tabbing away and back to a window will defeat our reconnect backoff, but I think that's fine.
	        if (visible &&
	            !this.visible_ &&
	            this.reconnectDelay_ === this.maxReconnectDelay_) {
	            this.log_('Window became visible.  Reducing delay.');
	            this.reconnectDelay_ = RECONNECT_MIN_DELAY;
	            if (!this.realtime_) {
	                this.scheduleConnect_(0);
	            }
	        }
	        this.visible_ = visible;
	    }
	    onOnline_(online) {
	        if (online) {
	            this.log_('Browser went online.');
	            this.reconnectDelay_ = RECONNECT_MIN_DELAY;
	            if (!this.realtime_) {
	                this.scheduleConnect_(0);
	            }
	        }
	        else {
	            this.log_('Browser went offline.  Killing connection.');
	            if (this.realtime_) {
	                this.realtime_.close();
	            }
	        }
	    }
	    onRealtimeDisconnect_() {
	        this.log_('data client disconnected');
	        this.connected_ = false;
	        this.realtime_ = null;
	        // Since we don't know if our sent transactions succeeded or not, we need to cancel them.
	        this.cancelSentTransactions_();
	        // Clear out the pending requests.
	        this.requestCBHash_ = {};
	        if (this.shouldReconnect_()) {
	            if (!this.visible_) {
	                this.log_("Window isn't visible.  Delaying reconnect.");
	                this.reconnectDelay_ = this.maxReconnectDelay_;
	                this.lastConnectionAttemptTime_ = new Date().getTime();
	            }
	            else if (this.lastConnectionEstablishedTime_) {
	                // If we've been connected long enough, reset reconnect delay to minimum.
	                const timeSinceLastConnectSucceeded = new Date().getTime() - this.lastConnectionEstablishedTime_;
	                if (timeSinceLastConnectSucceeded > RECONNECT_DELAY_RESET_TIMEOUT) {
	                    this.reconnectDelay_ = RECONNECT_MIN_DELAY;
	                }
	                this.lastConnectionEstablishedTime_ = null;
	            }
	            const timeSinceLastConnectAttempt = new Date().getTime() - this.lastConnectionAttemptTime_;
	            let reconnectDelay = Math.max(0, this.reconnectDelay_ - timeSinceLastConnectAttempt);
	            reconnectDelay = Math.random() * reconnectDelay;
	            this.log_('Trying to reconnect in ' + reconnectDelay + 'ms');
	            this.scheduleConnect_(reconnectDelay);
	            // Adjust reconnect delay for next time.
	            this.reconnectDelay_ = Math.min(this.maxReconnectDelay_, this.reconnectDelay_ * RECONNECT_DELAY_MULTIPLIER);
	        }
	        this.onConnectStatus_(false);
	    }
	    async establishConnection_() {
	        if (this.shouldReconnect_()) {
	            this.log_('Making a connection attempt');
	            this.lastConnectionAttemptTime_ = new Date().getTime();
	            this.lastConnectionEstablishedTime_ = null;
	            const onDataMessage = this.onDataMessage_.bind(this);
	            const onReady = this.onReady_.bind(this);
	            const onDisconnect = this.onRealtimeDisconnect_.bind(this);
	            const connId = this.id + ':' + PersistentConnection.nextConnectionId_++;
	            const lastSessionId = this.lastSessionId;
	            let canceled = false;
	            let connection = null;
	            const closeFn = function () {
	                if (connection) {
	                    connection.close();
	                }
	                else {
	                    canceled = true;
	                    onDisconnect();
	                }
	            };
	            const sendRequestFn = function (msg) {
	                assert(connection, "sendRequest call when we're not connected not allowed.");
	                connection.sendRequest(msg);
	            };
	            this.realtime_ = {
	                close: closeFn,
	                sendRequest: sendRequestFn
	            };
	            const forceRefresh = this.forceTokenRefresh_;
	            this.forceTokenRefresh_ = false;
	            try {
	                // First fetch auth and app check token, and establish connection after
	                // fetching the token was successful
	                const [authToken, appCheckToken] = await Promise.all([
	                    this.authTokenProvider_.getToken(forceRefresh),
	                    this.appCheckTokenProvider_.getToken(forceRefresh)
	                ]);
	                if (!canceled) {
	                    log('getToken() completed. Creating connection.');
	                    this.authToken_ = authToken && authToken.accessToken;
	                    this.appCheckToken_ = appCheckToken && appCheckToken.token;
	                    connection = new Connection(connId, this.repoInfo_, this.applicationId_, this.appCheckToken_, this.authToken_, onDataMessage, onReady, onDisconnect, 
	                    /* onKill= */ reason => {
	                        warn(reason + ' (' + this.repoInfo_.toString() + ')');
	                        this.interrupt(SERVER_KILL_INTERRUPT_REASON);
	                    }, lastSessionId);
	                }
	                else {
	                    log('getToken() completed but was canceled');
	                }
	            }
	            catch (error) {
	                this.log_('Failed to get token: ' + error);
	                if (!canceled) {
	                    if (this.repoInfo_.nodeAdmin) {
	                        // This may be a critical error for the Admin Node.js SDK, so log a warning.
	                        // But getToken() may also just have temporarily failed, so we still want to
	                        // continue retrying.
	                        warn(error);
	                    }
	                    closeFn();
	                }
	            }
	        }
	    }
	    interrupt(reason) {
	        log('Interrupting connection for reason: ' + reason);
	        this.interruptReasons_[reason] = true;
	        if (this.realtime_) {
	            this.realtime_.close();
	        }
	        else {
	            if (this.establishConnectionTimer_) {
	                clearTimeout(this.establishConnectionTimer_);
	                this.establishConnectionTimer_ = null;
	            }
	            if (this.connected_) {
	                this.onRealtimeDisconnect_();
	            }
	        }
	    }
	    resume(reason) {
	        log('Resuming connection for reason: ' + reason);
	        delete this.interruptReasons_[reason];
	        if (isEmpty(this.interruptReasons_)) {
	            this.reconnectDelay_ = RECONNECT_MIN_DELAY;
	            if (!this.realtime_) {
	                this.scheduleConnect_(0);
	            }
	        }
	    }
	    handleTimestamp_(timestamp) {
	        const delta = timestamp - new Date().getTime();
	        this.onServerInfoUpdate_({ serverTimeOffset: delta });
	    }
	    cancelSentTransactions_() {
	        for (let i = 0; i < this.outstandingPuts_.length; i++) {
	            const put = this.outstandingPuts_[i];
	            if (put && /*hash*/ 'h' in put.request && put.queued) {
	                if (put.onComplete) {
	                    put.onComplete('disconnect');
	                }
	                delete this.outstandingPuts_[i];
	                this.outstandingPutCount_--;
	            }
	        }
	        // Clean up array occasionally.
	        if (this.outstandingPutCount_ === 0) {
	            this.outstandingPuts_ = [];
	        }
	    }
	    onListenRevoked_(pathString, query) {
	        // Remove the listen and manufacture a "permission_denied" error for the failed listen.
	        let queryId;
	        if (!query) {
	            queryId = 'default';
	        }
	        else {
	            queryId = query.map(q => ObjectToUniqueKey(q)).join('$');
	        }
	        const listen = this.removeListen_(pathString, queryId);
	        if (listen && listen.onComplete) {
	            listen.onComplete('permission_denied');
	        }
	    }
	    removeListen_(pathString, queryId) {
	        const normalizedPathString = new Path(pathString).toString(); // normalize path.
	        let listen;
	        if (this.listens.has(normalizedPathString)) {
	            const map = this.listens.get(normalizedPathString);
	            listen = map.get(queryId);
	            map.delete(queryId);
	            if (map.size === 0) {
	                this.listens.delete(normalizedPathString);
	            }
	        }
	        else {
	            // all listens for this path has already been removed
	            listen = undefined;
	        }
	        return listen;
	    }
	    onAuthRevoked_(statusCode, explanation) {
	        log('Auth token revoked: ' + statusCode + '/' + explanation);
	        this.authToken_ = null;
	        this.forceTokenRefresh_ = true;
	        this.realtime_.close();
	        if (statusCode === 'invalid_token' || statusCode === 'permission_denied') {
	            // We'll wait a couple times before logging the warning / increasing the
	            // retry period since oauth tokens will report as "invalid" if they're
	            // just expired. Plus there may be transient issues that resolve themselves.
	            this.invalidAuthTokenCount_++;
	            if (this.invalidAuthTokenCount_ >= INVALID_TOKEN_THRESHOLD) {
	                // Set a long reconnect delay because recovery is unlikely
	                this.reconnectDelay_ = RECONNECT_MAX_DELAY_FOR_ADMINS;
	                // Notify the auth token provider that the token is invalid, which will log
	                // a warning
	                this.authTokenProvider_.notifyForInvalidToken();
	            }
	        }
	    }
	    onAppCheckRevoked_(statusCode, explanation) {
	        log('App check token revoked: ' + statusCode + '/' + explanation);
	        this.appCheckToken_ = null;
	        this.forceTokenRefresh_ = true;
	        // Note: We don't close the connection as the developer may not have
	        // enforcement enabled. The backend closes connections with enforcements.
	        if (statusCode === 'invalid_token' || statusCode === 'permission_denied') {
	            // We'll wait a couple times before logging the warning / increasing the
	            // retry period since oauth tokens will report as "invalid" if they're
	            // just expired. Plus there may be transient issues that resolve themselves.
	            this.invalidAppCheckTokenCount_++;
	            if (this.invalidAppCheckTokenCount_ >= INVALID_TOKEN_THRESHOLD) {
	                this.appCheckTokenProvider_.notifyForInvalidToken();
	            }
	        }
	    }
	    onSecurityDebugPacket_(body) {
	        if (this.securityDebugCallback_) {
	            this.securityDebugCallback_(body);
	        }
	        else {
	            if ('msg' in body) {
	                console.log('FIREBASE: ' + body['msg'].replace('\n', '\nFIREBASE: '));
	            }
	        }
	    }
	    restoreState_() {
	        //Re-authenticate ourselves if we have a credential stored.
	        this.tryAuth();
	        this.tryAppCheck();
	        // Puts depend on having received the corresponding data update from the server before they complete, so we must
	        // make sure to send listens before puts.
	        for (const queries of this.listens.values()) {
	            for (const listenSpec of queries.values()) {
	                this.sendListen_(listenSpec);
	            }
	        }
	        for (let i = 0; i < this.outstandingPuts_.length; i++) {
	            if (this.outstandingPuts_[i]) {
	                this.sendPut_(i);
	            }
	        }
	        while (this.onDisconnectRequestQueue_.length) {
	            const request = this.onDisconnectRequestQueue_.shift();
	            this.sendOnDisconnect_(request.action, request.pathString, request.data, request.onComplete);
	        }
	        for (let i = 0; i < this.outstandingGets_.length; i++) {
	            if (this.outstandingGets_[i]) {
	                this.sendGet_(i);
	            }
	        }
	    }
	    /**
	     * Sends client stats for first connection
	     */
	    sendConnectStats_() {
	        const stats = {};
	        let clientName = 'js';
	        stats['sdk.' + clientName + '.' + SDK_VERSION.replace(/\./g, '-')] = 1;
	        if (isMobileCordova()) {
	            stats['framework.cordova'] = 1;
	        }
	        else if (isReactNative()) {
	            stats['framework.reactnative'] = 1;
	        }
	        this.reportStats(stats);
	    }
	    shouldReconnect_() {
	        const online = OnlineMonitor.getInstance().currentlyOnline();
	        return isEmpty(this.interruptReasons_) && online;
	    }
	}
	PersistentConnection.nextPersistentConnectionId_ = 0;
	/**
	 * Counter for number of connections created. Mainly used for tagging in the logs
	 */
	PersistentConnection.nextConnectionId_ = 0;

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class NamedNode {
	    constructor(name, node) {
	        this.name = name;
	        this.node = node;
	    }
	    static Wrap(name, node) {
	        return new NamedNode(name, node);
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class Index {
	    /**
	     * @returns A standalone comparison function for
	     * this index
	     */
	    getCompare() {
	        return this.compare.bind(this);
	    }
	    /**
	     * Given a before and after value for a node, determine if the indexed value has changed. Even if they are different,
	     * it's possible that the changes are isolated to parts of the snapshot that are not indexed.
	     *
	     *
	     * @returns True if the portion of the snapshot being indexed changed between oldNode and newNode
	     */
	    indexedValueChanged(oldNode, newNode) {
	        const oldWrapped = new NamedNode(MIN_NAME, oldNode);
	        const newWrapped = new NamedNode(MIN_NAME, newNode);
	        return this.compare(oldWrapped, newWrapped) !== 0;
	    }
	    /**
	     * @returns a node wrapper that will sort equal to or less than
	     * any other node wrapper, using this index
	     */
	    minPost() {
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        return NamedNode.MIN;
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	let __EMPTY_NODE;
	class KeyIndex extends Index {
	    static get __EMPTY_NODE() {
	        return __EMPTY_NODE;
	    }
	    static set __EMPTY_NODE(val) {
	        __EMPTY_NODE = val;
	    }
	    compare(a, b) {
	        return nameCompare(a.name, b.name);
	    }
	    isDefinedOn(node) {
	        // We could probably return true here (since every node has a key), but it's never called
	        // so just leaving unimplemented for now.
	        throw assertionError('KeyIndex.isDefinedOn not expected to be called.');
	    }
	    indexedValueChanged(oldNode, newNode) {
	        return false; // The key for a node never changes.
	    }
	    minPost() {
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        return NamedNode.MIN;
	    }
	    maxPost() {
	        // TODO: This should really be created once and cached in a static property, but
	        // NamedNode isn't defined yet, so I can't use it in a static.  Bleh.
	        return new NamedNode(MAX_NAME, __EMPTY_NODE);
	    }
	    makePost(indexValue, name) {
	        assert(typeof indexValue === 'string', 'KeyIndex indexValue must always be a string.');
	        // We just use empty node, but it'll never be compared, since our comparator only looks at name.
	        return new NamedNode(indexValue, __EMPTY_NODE);
	    }
	    /**
	     * @returns String representation for inclusion in a query spec
	     */
	    toString() {
	        return '.key';
	    }
	}
	const KEY_INDEX = new KeyIndex();

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * An iterator over an LLRBNode.
	 */
	class SortedMapIterator {
	    /**
	     * @param node - Node to iterate.
	     * @param isReverse_ - Whether or not to iterate in reverse
	     */
	    constructor(node, startKey, comparator, isReverse_, resultGenerator_ = null) {
	        this.isReverse_ = isReverse_;
	        this.resultGenerator_ = resultGenerator_;
	        this.nodeStack_ = [];
	        let cmp = 1;
	        while (!node.isEmpty()) {
	            node = node;
	            cmp = startKey ? comparator(node.key, startKey) : 1;
	            // flip the comparison if we're going in reverse
	            if (isReverse_) {
	                cmp *= -1;
	            }
	            if (cmp < 0) {
	                // This node is less than our start key. ignore it
	                if (this.isReverse_) {
	                    node = node.left;
	                }
	                else {
	                    node = node.right;
	                }
	            }
	            else if (cmp === 0) {
	                // This node is exactly equal to our start key. Push it on the stack, but stop iterating;
	                this.nodeStack_.push(node);
	                break;
	            }
	            else {
	                // This node is greater than our start key, add it to the stack and move to the next one
	                this.nodeStack_.push(node);
	                if (this.isReverse_) {
	                    node = node.right;
	                }
	                else {
	                    node = node.left;
	                }
	            }
	        }
	    }
	    getNext() {
	        if (this.nodeStack_.length === 0) {
	            return null;
	        }
	        let node = this.nodeStack_.pop();
	        let result;
	        if (this.resultGenerator_) {
	            result = this.resultGenerator_(node.key, node.value);
	        }
	        else {
	            result = { key: node.key, value: node.value };
	        }
	        if (this.isReverse_) {
	            node = node.left;
	            while (!node.isEmpty()) {
	                this.nodeStack_.push(node);
	                node = node.right;
	            }
	        }
	        else {
	            node = node.right;
	            while (!node.isEmpty()) {
	                this.nodeStack_.push(node);
	                node = node.left;
	            }
	        }
	        return result;
	    }
	    hasNext() {
	        return this.nodeStack_.length > 0;
	    }
	    peek() {
	        if (this.nodeStack_.length === 0) {
	            return null;
	        }
	        const node = this.nodeStack_[this.nodeStack_.length - 1];
	        if (this.resultGenerator_) {
	            return this.resultGenerator_(node.key, node.value);
	        }
	        else {
	            return { key: node.key, value: node.value };
	        }
	    }
	}
	/**
	 * Represents a node in a Left-leaning Red-Black tree.
	 */
	class LLRBNode {
	    /**
	     * @param key - Key associated with this node.
	     * @param value - Value associated with this node.
	     * @param color - Whether this node is red.
	     * @param left - Left child.
	     * @param right - Right child.
	     */
	    constructor(key, value, color, left, right) {
	        this.key = key;
	        this.value = value;
	        this.color = color != null ? color : LLRBNode.RED;
	        this.left =
	            left != null ? left : SortedMap.EMPTY_NODE;
	        this.right =
	            right != null ? right : SortedMap.EMPTY_NODE;
	    }
	    /**
	     * Returns a copy of the current node, optionally replacing pieces of it.
	     *
	     * @param key - New key for the node, or null.
	     * @param value - New value for the node, or null.
	     * @param color - New color for the node, or null.
	     * @param left - New left child for the node, or null.
	     * @param right - New right child for the node, or null.
	     * @returns The node copy.
	     */
	    copy(key, value, color, left, right) {
	        return new LLRBNode(key != null ? key : this.key, value != null ? value : this.value, color != null ? color : this.color, left != null ? left : this.left, right != null ? right : this.right);
	    }
	    /**
	     * @returns The total number of nodes in the tree.
	     */
	    count() {
	        return this.left.count() + 1 + this.right.count();
	    }
	    /**
	     * @returns True if the tree is empty.
	     */
	    isEmpty() {
	        return false;
	    }
	    /**
	     * Traverses the tree in key order and calls the specified action function
	     * for each node.
	     *
	     * @param action - Callback function to be called for each
	     *   node.  If it returns true, traversal is aborted.
	     * @returns The first truthy value returned by action, or the last falsey
	     *   value returned by action
	     */
	    inorderTraversal(action) {
	        return (this.left.inorderTraversal(action) ||
	            !!action(this.key, this.value) ||
	            this.right.inorderTraversal(action));
	    }
	    /**
	     * Traverses the tree in reverse key order and calls the specified action function
	     * for each node.
	     *
	     * @param action - Callback function to be called for each
	     * node.  If it returns true, traversal is aborted.
	     * @returns True if traversal was aborted.
	     */
	    reverseTraversal(action) {
	        return (this.right.reverseTraversal(action) ||
	            action(this.key, this.value) ||
	            this.left.reverseTraversal(action));
	    }
	    /**
	     * @returns The minimum node in the tree.
	     */
	    min_() {
	        if (this.left.isEmpty()) {
	            return this;
	        }
	        else {
	            return this.left.min_();
	        }
	    }
	    /**
	     * @returns The maximum key in the tree.
	     */
	    minKey() {
	        return this.min_().key;
	    }
	    /**
	     * @returns The maximum key in the tree.
	     */
	    maxKey() {
	        if (this.right.isEmpty()) {
	            return this.key;
	        }
	        else {
	            return this.right.maxKey();
	        }
	    }
	    /**
	     * @param key - Key to insert.
	     * @param value - Value to insert.
	     * @param comparator - Comparator.
	     * @returns New tree, with the key/value added.
	     */
	    insert(key, value, comparator) {
	        let n = this;
	        const cmp = comparator(key, n.key);
	        if (cmp < 0) {
	            n = n.copy(null, null, null, n.left.insert(key, value, comparator), null);
	        }
	        else if (cmp === 0) {
	            n = n.copy(null, value, null, null, null);
	        }
	        else {
	            n = n.copy(null, null, null, null, n.right.insert(key, value, comparator));
	        }
	        return n.fixUp_();
	    }
	    /**
	     * @returns New tree, with the minimum key removed.
	     */
	    removeMin_() {
	        if (this.left.isEmpty()) {
	            return SortedMap.EMPTY_NODE;
	        }
	        let n = this;
	        if (!n.left.isRed_() && !n.left.left.isRed_()) {
	            n = n.moveRedLeft_();
	        }
	        n = n.copy(null, null, null, n.left.removeMin_(), null);
	        return n.fixUp_();
	    }
	    /**
	     * @param key - The key of the item to remove.
	     * @param comparator - Comparator.
	     * @returns New tree, with the specified item removed.
	     */
	    remove(key, comparator) {
	        let n, smallest;
	        n = this;
	        if (comparator(key, n.key) < 0) {
	            if (!n.left.isEmpty() && !n.left.isRed_() && !n.left.left.isRed_()) {
	                n = n.moveRedLeft_();
	            }
	            n = n.copy(null, null, null, n.left.remove(key, comparator), null);
	        }
	        else {
	            if (n.left.isRed_()) {
	                n = n.rotateRight_();
	            }
	            if (!n.right.isEmpty() && !n.right.isRed_() && !n.right.left.isRed_()) {
	                n = n.moveRedRight_();
	            }
	            if (comparator(key, n.key) === 0) {
	                if (n.right.isEmpty()) {
	                    return SortedMap.EMPTY_NODE;
	                }
	                else {
	                    smallest = n.right.min_();
	                    n = n.copy(smallest.key, smallest.value, null, null, n.right.removeMin_());
	                }
	            }
	            n = n.copy(null, null, null, null, n.right.remove(key, comparator));
	        }
	        return n.fixUp_();
	    }
	    /**
	     * @returns Whether this is a RED node.
	     */
	    isRed_() {
	        return this.color;
	    }
	    /**
	     * @returns New tree after performing any needed rotations.
	     */
	    fixUp_() {
	        let n = this;
	        if (n.right.isRed_() && !n.left.isRed_()) {
	            n = n.rotateLeft_();
	        }
	        if (n.left.isRed_() && n.left.left.isRed_()) {
	            n = n.rotateRight_();
	        }
	        if (n.left.isRed_() && n.right.isRed_()) {
	            n = n.colorFlip_();
	        }
	        return n;
	    }
	    /**
	     * @returns New tree, after moveRedLeft.
	     */
	    moveRedLeft_() {
	        let n = this.colorFlip_();
	        if (n.right.left.isRed_()) {
	            n = n.copy(null, null, null, null, n.right.rotateRight_());
	            n = n.rotateLeft_();
	            n = n.colorFlip_();
	        }
	        return n;
	    }
	    /**
	     * @returns New tree, after moveRedRight.
	     */
	    moveRedRight_() {
	        let n = this.colorFlip_();
	        if (n.left.left.isRed_()) {
	            n = n.rotateRight_();
	            n = n.colorFlip_();
	        }
	        return n;
	    }
	    /**
	     * @returns New tree, after rotateLeft.
	     */
	    rotateLeft_() {
	        const nl = this.copy(null, null, LLRBNode.RED, null, this.right.left);
	        return this.right.copy(null, null, this.color, nl, null);
	    }
	    /**
	     * @returns New tree, after rotateRight.
	     */
	    rotateRight_() {
	        const nr = this.copy(null, null, LLRBNode.RED, this.left.right, null);
	        return this.left.copy(null, null, this.color, null, nr);
	    }
	    /**
	     * @returns Newt ree, after colorFlip.
	     */
	    colorFlip_() {
	        const left = this.left.copy(null, null, !this.left.color, null, null);
	        const right = this.right.copy(null, null, !this.right.color, null, null);
	        return this.copy(null, null, !this.color, left, right);
	    }
	    /**
	     * For testing.
	     *
	     * @returns True if all is well.
	     */
	    checkMaxDepth_() {
	        const blackDepth = this.check_();
	        return Math.pow(2.0, blackDepth) <= this.count() + 1;
	    }
	    check_() {
	        if (this.isRed_() && this.left.isRed_()) {
	            throw new Error('Red node has red child(' + this.key + ',' + this.value + ')');
	        }
	        if (this.right.isRed_()) {
	            throw new Error('Right child of (' + this.key + ',' + this.value + ') is red');
	        }
	        const blackDepth = this.left.check_();
	        if (blackDepth !== this.right.check_()) {
	            throw new Error('Black depths differ');
	        }
	        else {
	            return blackDepth + (this.isRed_() ? 0 : 1);
	        }
	    }
	}
	LLRBNode.RED = true;
	LLRBNode.BLACK = false;
	/**
	 * Represents an empty node (a leaf node in the Red-Black Tree).
	 */
	class LLRBEmptyNode {
	    /**
	     * Returns a copy of the current node.
	     *
	     * @returns The node copy.
	     */
	    copy(key, value, color, left, right) {
	        return this;
	    }
	    /**
	     * Returns a copy of the tree, with the specified key/value added.
	     *
	     * @param key - Key to be added.
	     * @param value - Value to be added.
	     * @param comparator - Comparator.
	     * @returns New tree, with item added.
	     */
	    insert(key, value, comparator) {
	        return new LLRBNode(key, value, null);
	    }
	    /**
	     * Returns a copy of the tree, with the specified key removed.
	     *
	     * @param key - The key to remove.
	     * @param comparator - Comparator.
	     * @returns New tree, with item removed.
	     */
	    remove(key, comparator) {
	        return this;
	    }
	    /**
	     * @returns The total number of nodes in the tree.
	     */
	    count() {
	        return 0;
	    }
	    /**
	     * @returns True if the tree is empty.
	     */
	    isEmpty() {
	        return true;
	    }
	    /**
	     * Traverses the tree in key order and calls the specified action function
	     * for each node.
	     *
	     * @param action - Callback function to be called for each
	     * node.  If it returns true, traversal is aborted.
	     * @returns True if traversal was aborted.
	     */
	    inorderTraversal(action) {
	        return false;
	    }
	    /**
	     * Traverses the tree in reverse key order and calls the specified action function
	     * for each node.
	     *
	     * @param action - Callback function to be called for each
	     * node.  If it returns true, traversal is aborted.
	     * @returns True if traversal was aborted.
	     */
	    reverseTraversal(action) {
	        return false;
	    }
	    minKey() {
	        return null;
	    }
	    maxKey() {
	        return null;
	    }
	    check_() {
	        return 0;
	    }
	    /**
	     * @returns Whether this node is red.
	     */
	    isRed_() {
	        return false;
	    }
	}
	/**
	 * An immutable sorted map implementation, based on a Left-leaning Red-Black
	 * tree.
	 */
	class SortedMap {
	    /**
	     * @param comparator_ - Key comparator.
	     * @param root_ - Optional root node for the map.
	     */
	    constructor(comparator_, root_ = SortedMap.EMPTY_NODE) {
	        this.comparator_ = comparator_;
	        this.root_ = root_;
	    }
	    /**
	     * Returns a copy of the map, with the specified key/value added or replaced.
	     * (TODO: We should perhaps rename this method to 'put')
	     *
	     * @param key - Key to be added.
	     * @param value - Value to be added.
	     * @returns New map, with item added.
	     */
	    insert(key, value) {
	        return new SortedMap(this.comparator_, this.root_
	            .insert(key, value, this.comparator_)
	            .copy(null, null, LLRBNode.BLACK, null, null));
	    }
	    /**
	     * Returns a copy of the map, with the specified key removed.
	     *
	     * @param key - The key to remove.
	     * @returns New map, with item removed.
	     */
	    remove(key) {
	        return new SortedMap(this.comparator_, this.root_
	            .remove(key, this.comparator_)
	            .copy(null, null, LLRBNode.BLACK, null, null));
	    }
	    /**
	     * Returns the value of the node with the given key, or null.
	     *
	     * @param key - The key to look up.
	     * @returns The value of the node with the given key, or null if the
	     * key doesn't exist.
	     */
	    get(key) {
	        let cmp;
	        let node = this.root_;
	        while (!node.isEmpty()) {
	            cmp = this.comparator_(key, node.key);
	            if (cmp === 0) {
	                return node.value;
	            }
	            else if (cmp < 0) {
	                node = node.left;
	            }
	            else if (cmp > 0) {
	                node = node.right;
	            }
	        }
	        return null;
	    }
	    /**
	     * Returns the key of the item *before* the specified key, or null if key is the first item.
	     * @param key - The key to find the predecessor of
	     * @returns The predecessor key.
	     */
	    getPredecessorKey(key) {
	        let cmp, node = this.root_, rightParent = null;
	        while (!node.isEmpty()) {
	            cmp = this.comparator_(key, node.key);
	            if (cmp === 0) {
	                if (!node.left.isEmpty()) {
	                    node = node.left;
	                    while (!node.right.isEmpty()) {
	                        node = node.right;
	                    }
	                    return node.key;
	                }
	                else if (rightParent) {
	                    return rightParent.key;
	                }
	                else {
	                    return null; // first item.
	                }
	            }
	            else if (cmp < 0) {
	                node = node.left;
	            }
	            else if (cmp > 0) {
	                rightParent = node;
	                node = node.right;
	            }
	        }
	        throw new Error('Attempted to find predecessor key for a nonexistent key.  What gives?');
	    }
	    /**
	     * @returns True if the map is empty.
	     */
	    isEmpty() {
	        return this.root_.isEmpty();
	    }
	    /**
	     * @returns The total number of nodes in the map.
	     */
	    count() {
	        return this.root_.count();
	    }
	    /**
	     * @returns The minimum key in the map.
	     */
	    minKey() {
	        return this.root_.minKey();
	    }
	    /**
	     * @returns The maximum key in the map.
	     */
	    maxKey() {
	        return this.root_.maxKey();
	    }
	    /**
	     * Traverses the map in key order and calls the specified action function
	     * for each key/value pair.
	     *
	     * @param action - Callback function to be called
	     * for each key/value pair.  If action returns true, traversal is aborted.
	     * @returns The first truthy value returned by action, or the last falsey
	     *   value returned by action
	     */
	    inorderTraversal(action) {
	        return this.root_.inorderTraversal(action);
	    }
	    /**
	     * Traverses the map in reverse key order and calls the specified action function
	     * for each key/value pair.
	     *
	     * @param action - Callback function to be called
	     * for each key/value pair.  If action returns true, traversal is aborted.
	     * @returns True if the traversal was aborted.
	     */
	    reverseTraversal(action) {
	        return this.root_.reverseTraversal(action);
	    }
	    /**
	     * Returns an iterator over the SortedMap.
	     * @returns The iterator.
	     */
	    getIterator(resultGenerator) {
	        return new SortedMapIterator(this.root_, null, this.comparator_, false, resultGenerator);
	    }
	    getIteratorFrom(key, resultGenerator) {
	        return new SortedMapIterator(this.root_, key, this.comparator_, false, resultGenerator);
	    }
	    getReverseIteratorFrom(key, resultGenerator) {
	        return new SortedMapIterator(this.root_, key, this.comparator_, true, resultGenerator);
	    }
	    getReverseIterator(resultGenerator) {
	        return new SortedMapIterator(this.root_, null, this.comparator_, true, resultGenerator);
	    }
	}
	/**
	 * Always use the same empty node, to reduce memory.
	 */
	SortedMap.EMPTY_NODE = new LLRBEmptyNode();

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function NAME_ONLY_COMPARATOR(left, right) {
	    return nameCompare(left.name, right.name);
	}
	function NAME_COMPARATOR(left, right) {
	    return nameCompare(left, right);
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	let MAX_NODE$2;
	function setMaxNode$1(val) {
	    MAX_NODE$2 = val;
	}
	const priorityHashText = function (priority) {
	    if (typeof priority === 'number') {
	        return 'number:' + doubleToIEEE754String(priority);
	    }
	    else {
	        return 'string:' + priority;
	    }
	};
	/**
	 * Validates that a priority snapshot Node is valid.
	 */
	const validatePriorityNode = function (priorityNode) {
	    if (priorityNode.isLeafNode()) {
	        const val = priorityNode.val();
	        assert(typeof val === 'string' ||
	            typeof val === 'number' ||
	            (typeof val === 'object' && contains(val, '.sv')), 'Priority must be a string or number.');
	    }
	    else {
	        assert(priorityNode === MAX_NODE$2 || priorityNode.isEmpty(), 'priority of unexpected type.');
	    }
	    // Don't call getPriority() on MAX_NODE to avoid hitting assertion.
	    assert(priorityNode === MAX_NODE$2 || priorityNode.getPriority().isEmpty(), "Priority nodes can't have a priority of their own.");
	};

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	let __childrenNodeConstructor;
	/**
	 * LeafNode is a class for storing leaf nodes in a DataSnapshot.  It
	 * implements Node and stores the value of the node (a string,
	 * number, or boolean) accessible via getValue().
	 */
	class LeafNode {
	    /**
	     * @param value_ - The value to store in this leaf node. The object type is
	     * possible in the event of a deferred value
	     * @param priorityNode_ - The priority of this node.
	     */
	    constructor(value_, priorityNode_ = LeafNode.__childrenNodeConstructor.EMPTY_NODE) {
	        this.value_ = value_;
	        this.priorityNode_ = priorityNode_;
	        this.lazyHash_ = null;
	        assert(this.value_ !== undefined && this.value_ !== null, "LeafNode shouldn't be created with null/undefined value.");
	        validatePriorityNode(this.priorityNode_);
	    }
	    static set __childrenNodeConstructor(val) {
	        __childrenNodeConstructor = val;
	    }
	    static get __childrenNodeConstructor() {
	        return __childrenNodeConstructor;
	    }
	    /** @inheritDoc */
	    isLeafNode() {
	        return true;
	    }
	    /** @inheritDoc */
	    getPriority() {
	        return this.priorityNode_;
	    }
	    /** @inheritDoc */
	    updatePriority(newPriorityNode) {
	        return new LeafNode(this.value_, newPriorityNode);
	    }
	    /** @inheritDoc */
	    getImmediateChild(childName) {
	        // Hack to treat priority as a regular child
	        if (childName === '.priority') {
	            return this.priorityNode_;
	        }
	        else {
	            return LeafNode.__childrenNodeConstructor.EMPTY_NODE;
	        }
	    }
	    /** @inheritDoc */
	    getChild(path) {
	        if (pathIsEmpty(path)) {
	            return this;
	        }
	        else if (pathGetFront(path) === '.priority') {
	            return this.priorityNode_;
	        }
	        else {
	            return LeafNode.__childrenNodeConstructor.EMPTY_NODE;
	        }
	    }
	    hasChild() {
	        return false;
	    }
	    /** @inheritDoc */
	    getPredecessorChildName(childName, childNode) {
	        return null;
	    }
	    /** @inheritDoc */
	    updateImmediateChild(childName, newChildNode) {
	        if (childName === '.priority') {
	            return this.updatePriority(newChildNode);
	        }
	        else if (newChildNode.isEmpty() && childName !== '.priority') {
	            return this;
	        }
	        else {
	            return LeafNode.__childrenNodeConstructor.EMPTY_NODE.updateImmediateChild(childName, newChildNode).updatePriority(this.priorityNode_);
	        }
	    }
	    /** @inheritDoc */
	    updateChild(path, newChildNode) {
	        const front = pathGetFront(path);
	        if (front === null) {
	            return newChildNode;
	        }
	        else if (newChildNode.isEmpty() && front !== '.priority') {
	            return this;
	        }
	        else {
	            assert(front !== '.priority' || pathGetLength(path) === 1, '.priority must be the last token in a path');
	            return this.updateImmediateChild(front, LeafNode.__childrenNodeConstructor.EMPTY_NODE.updateChild(pathPopFront(path), newChildNode));
	        }
	    }
	    /** @inheritDoc */
	    isEmpty() {
	        return false;
	    }
	    /** @inheritDoc */
	    numChildren() {
	        return 0;
	    }
	    /** @inheritDoc */
	    forEachChild(index, action) {
	        return false;
	    }
	    val(exportFormat) {
	        if (exportFormat && !this.getPriority().isEmpty()) {
	            return {
	                '.value': this.getValue(),
	                '.priority': this.getPriority().val()
	            };
	        }
	        else {
	            return this.getValue();
	        }
	    }
	    /** @inheritDoc */
	    hash() {
	        if (this.lazyHash_ === null) {
	            let toHash = '';
	            if (!this.priorityNode_.isEmpty()) {
	                toHash +=
	                    'priority:' +
	                        priorityHashText(this.priorityNode_.val()) +
	                        ':';
	            }
	            const type = typeof this.value_;
	            toHash += type + ':';
	            if (type === 'number') {
	                toHash += doubleToIEEE754String(this.value_);
	            }
	            else {
	                toHash += this.value_;
	            }
	            this.lazyHash_ = sha1(toHash);
	        }
	        return this.lazyHash_;
	    }
	    /**
	     * Returns the value of the leaf node.
	     * @returns The value of the node.
	     */
	    getValue() {
	        return this.value_;
	    }
	    compareTo(other) {
	        if (other === LeafNode.__childrenNodeConstructor.EMPTY_NODE) {
	            return 1;
	        }
	        else if (other instanceof LeafNode.__childrenNodeConstructor) {
	            return -1;
	        }
	        else {
	            assert(other.isLeafNode(), 'Unknown node type');
	            return this.compareToLeafNode_(other);
	        }
	    }
	    /**
	     * Comparison specifically for two leaf nodes
	     */
	    compareToLeafNode_(otherLeaf) {
	        const otherLeafType = typeof otherLeaf.value_;
	        const thisLeafType = typeof this.value_;
	        const otherIndex = LeafNode.VALUE_TYPE_ORDER.indexOf(otherLeafType);
	        const thisIndex = LeafNode.VALUE_TYPE_ORDER.indexOf(thisLeafType);
	        assert(otherIndex >= 0, 'Unknown leaf type: ' + otherLeafType);
	        assert(thisIndex >= 0, 'Unknown leaf type: ' + thisLeafType);
	        if (otherIndex === thisIndex) {
	            // Same type, compare values
	            if (thisLeafType === 'object') {
	                // Deferred value nodes are all equal, but we should also never get to this point...
	                return 0;
	            }
	            else {
	                // Note that this works because true > false, all others are number or string comparisons
	                if (this.value_ < otherLeaf.value_) {
	                    return -1;
	                }
	                else if (this.value_ === otherLeaf.value_) {
	                    return 0;
	                }
	                else {
	                    return 1;
	                }
	            }
	        }
	        else {
	            return thisIndex - otherIndex;
	        }
	    }
	    withIndex() {
	        return this;
	    }
	    isIndexed() {
	        return true;
	    }
	    equals(other) {
	        if (other === this) {
	            return true;
	        }
	        else if (other.isLeafNode()) {
	            const otherLeaf = other;
	            return (this.value_ === otherLeaf.value_ &&
	                this.priorityNode_.equals(otherLeaf.priorityNode_));
	        }
	        else {
	            return false;
	        }
	    }
	}
	/**
	 * The sort order for comparing leaf nodes of different types. If two leaf nodes have
	 * the same type, the comparison falls back to their value
	 */
	LeafNode.VALUE_TYPE_ORDER = ['object', 'boolean', 'number', 'string'];

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	let nodeFromJSON$1;
	let MAX_NODE$1;
	function setNodeFromJSON(val) {
	    nodeFromJSON$1 = val;
	}
	function setMaxNode(val) {
	    MAX_NODE$1 = val;
	}
	class PriorityIndex extends Index {
	    compare(a, b) {
	        const aPriority = a.node.getPriority();
	        const bPriority = b.node.getPriority();
	        const indexCmp = aPriority.compareTo(bPriority);
	        if (indexCmp === 0) {
	            return nameCompare(a.name, b.name);
	        }
	        else {
	            return indexCmp;
	        }
	    }
	    isDefinedOn(node) {
	        return !node.getPriority().isEmpty();
	    }
	    indexedValueChanged(oldNode, newNode) {
	        return !oldNode.getPriority().equals(newNode.getPriority());
	    }
	    minPost() {
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        return NamedNode.MIN;
	    }
	    maxPost() {
	        return new NamedNode(MAX_NAME, new LeafNode('[PRIORITY-POST]', MAX_NODE$1));
	    }
	    makePost(indexValue, name) {
	        const priorityNode = nodeFromJSON$1(indexValue);
	        return new NamedNode(name, new LeafNode('[PRIORITY-POST]', priorityNode));
	    }
	    /**
	     * @returns String representation for inclusion in a query spec
	     */
	    toString() {
	        return '.priority';
	    }
	}
	const PRIORITY_INDEX = new PriorityIndex();

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const LOG_2 = Math.log(2);
	class Base12Num {
	    constructor(length) {
	        const logBase2 = (num) => 
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        parseInt((Math.log(num) / LOG_2), 10);
	        const bitMask = (bits) => parseInt(Array(bits + 1).join('1'), 2);
	        this.count = logBase2(length + 1);
	        this.current_ = this.count - 1;
	        const mask = bitMask(this.count);
	        this.bits_ = (length + 1) & mask;
	    }
	    nextBitIsOne() {
	        //noinspection JSBitwiseOperatorUsage
	        const result = !(this.bits_ & (0x1 << this.current_));
	        this.current_--;
	        return result;
	    }
	}
	/**
	 * Takes a list of child nodes and constructs a SortedSet using the given comparison
	 * function
	 *
	 * Uses the algorithm described in the paper linked here:
	 * http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.46.1458
	 *
	 * @param childList - Unsorted list of children
	 * @param cmp - The comparison method to be used
	 * @param keyFn - An optional function to extract K from a node wrapper, if K's
	 * type is not NamedNode
	 * @param mapSortFn - An optional override for comparator used by the generated sorted map
	 */
	const buildChildSet = function (childList, cmp, keyFn, mapSortFn) {
	    childList.sort(cmp);
	    const buildBalancedTree = function (low, high) {
	        const length = high - low;
	        let namedNode;
	        let key;
	        if (length === 0) {
	            return null;
	        }
	        else if (length === 1) {
	            namedNode = childList[low];
	            key = keyFn ? keyFn(namedNode) : namedNode;
	            return new LLRBNode(key, namedNode.node, LLRBNode.BLACK, null, null);
	        }
	        else {
	            // eslint-disable-next-line @typescript-eslint/no-explicit-any
	            const middle = parseInt((length / 2), 10) + low;
	            const left = buildBalancedTree(low, middle);
	            const right = buildBalancedTree(middle + 1, high);
	            namedNode = childList[middle];
	            key = keyFn ? keyFn(namedNode) : namedNode;
	            return new LLRBNode(key, namedNode.node, LLRBNode.BLACK, left, right);
	        }
	    };
	    const buildFrom12Array = function (base12) {
	        let node = null;
	        let root = null;
	        let index = childList.length;
	        const buildPennant = function (chunkSize, color) {
	            const low = index - chunkSize;
	            const high = index;
	            index -= chunkSize;
	            const childTree = buildBalancedTree(low + 1, high);
	            const namedNode = childList[low];
	            const key = keyFn ? keyFn(namedNode) : namedNode;
	            attachPennant(new LLRBNode(key, namedNode.node, color, null, childTree));
	        };
	        const attachPennant = function (pennant) {
	            if (node) {
	                node.left = pennant;
	                node = pennant;
	            }
	            else {
	                root = pennant;
	                node = pennant;
	            }
	        };
	        for (let i = 0; i < base12.count; ++i) {
	            const isOne = base12.nextBitIsOne();
	            // The number of nodes taken in each slice is 2^(arr.length - (i + 1))
	            const chunkSize = Math.pow(2, base12.count - (i + 1));
	            if (isOne) {
	                buildPennant(chunkSize, LLRBNode.BLACK);
	            }
	            else {
	                // current == 2
	                buildPennant(chunkSize, LLRBNode.BLACK);
	                buildPennant(chunkSize, LLRBNode.RED);
	            }
	        }
	        return root;
	    };
	    const base12 = new Base12Num(childList.length);
	    const root = buildFrom12Array(base12);
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    return new SortedMap(mapSortFn || cmp, root);
	};

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	let _defaultIndexMap;
	const fallbackObject = {};
	class IndexMap {
	    constructor(indexes_, indexSet_) {
	        this.indexes_ = indexes_;
	        this.indexSet_ = indexSet_;
	    }
	    /**
	     * The default IndexMap for nodes without a priority
	     */
	    static get Default() {
	        assert(fallbackObject && PRIORITY_INDEX, 'ChildrenNode.ts has not been loaded');
	        _defaultIndexMap =
	            _defaultIndexMap ||
	                new IndexMap({ '.priority': fallbackObject }, { '.priority': PRIORITY_INDEX });
	        return _defaultIndexMap;
	    }
	    get(indexKey) {
	        const sortedMap = safeGet(this.indexes_, indexKey);
	        if (!sortedMap) {
	            throw new Error('No index defined for ' + indexKey);
	        }
	        if (sortedMap instanceof SortedMap) {
	            return sortedMap;
	        }
	        else {
	            // The index exists, but it falls back to just name comparison. Return null so that the calling code uses the
	            // regular child map
	            return null;
	        }
	    }
	    hasIndex(indexDefinition) {
	        return contains(this.indexSet_, indexDefinition.toString());
	    }
	    addIndex(indexDefinition, existingChildren) {
	        assert(indexDefinition !== KEY_INDEX, "KeyIndex always exists and isn't meant to be added to the IndexMap.");
	        const childList = [];
	        let sawIndexedValue = false;
	        const iter = existingChildren.getIterator(NamedNode.Wrap);
	        let next = iter.getNext();
	        while (next) {
	            sawIndexedValue =
	                sawIndexedValue || indexDefinition.isDefinedOn(next.node);
	            childList.push(next);
	            next = iter.getNext();
	        }
	        let newIndex;
	        if (sawIndexedValue) {
	            newIndex = buildChildSet(childList, indexDefinition.getCompare());
	        }
	        else {
	            newIndex = fallbackObject;
	        }
	        const indexName = indexDefinition.toString();
	        const newIndexSet = Object.assign({}, this.indexSet_);
	        newIndexSet[indexName] = indexDefinition;
	        const newIndexes = Object.assign({}, this.indexes_);
	        newIndexes[indexName] = newIndex;
	        return new IndexMap(newIndexes, newIndexSet);
	    }
	    /**
	     * Ensure that this node is properly tracked in any indexes that we're maintaining
	     */
	    addToIndexes(namedNode, existingChildren) {
	        const newIndexes = map(this.indexes_, (indexedChildren, indexName) => {
	            const index = safeGet(this.indexSet_, indexName);
	            assert(index, 'Missing index implementation for ' + indexName);
	            if (indexedChildren === fallbackObject) {
	                // Check to see if we need to index everything
	                if (index.isDefinedOn(namedNode.node)) {
	                    // We need to build this index
	                    const childList = [];
	                    const iter = existingChildren.getIterator(NamedNode.Wrap);
	                    let next = iter.getNext();
	                    while (next) {
	                        if (next.name !== namedNode.name) {
	                            childList.push(next);
	                        }
	                        next = iter.getNext();
	                    }
	                    childList.push(namedNode);
	                    return buildChildSet(childList, index.getCompare());
	                }
	                else {
	                    // No change, this remains a fallback
	                    return fallbackObject;
	                }
	            }
	            else {
	                const existingSnap = existingChildren.get(namedNode.name);
	                let newChildren = indexedChildren;
	                if (existingSnap) {
	                    newChildren = newChildren.remove(new NamedNode(namedNode.name, existingSnap));
	                }
	                return newChildren.insert(namedNode, namedNode.node);
	            }
	        });
	        return new IndexMap(newIndexes, this.indexSet_);
	    }
	    /**
	     * Create a new IndexMap instance with the given value removed
	     */
	    removeFromIndexes(namedNode, existingChildren) {
	        const newIndexes = map(this.indexes_, (indexedChildren) => {
	            if (indexedChildren === fallbackObject) {
	                // This is the fallback. Just return it, nothing to do in this case
	                return indexedChildren;
	            }
	            else {
	                const existingSnap = existingChildren.get(namedNode.name);
	                if (existingSnap) {
	                    return indexedChildren.remove(new NamedNode(namedNode.name, existingSnap));
	                }
	                else {
	                    // No record of this child
	                    return indexedChildren;
	                }
	            }
	        });
	        return new IndexMap(newIndexes, this.indexSet_);
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	// TODO: For memory savings, don't store priorityNode_ if it's empty.
	let EMPTY_NODE;
	/**
	 * ChildrenNode is a class for storing internal nodes in a DataSnapshot
	 * (i.e. nodes with children).  It implements Node and stores the
	 * list of children in the children property, sorted by child name.
	 */
	class ChildrenNode {
	    /**
	     * @param children_ - List of children of this node..
	     * @param priorityNode_ - The priority of this node (as a snapshot node).
	     */
	    constructor(children_, priorityNode_, indexMap_) {
	        this.children_ = children_;
	        this.priorityNode_ = priorityNode_;
	        this.indexMap_ = indexMap_;
	        this.lazyHash_ = null;
	        /**
	         * Note: The only reason we allow null priority is for EMPTY_NODE, since we can't use
	         * EMPTY_NODE as the priority of EMPTY_NODE.  We might want to consider making EMPTY_NODE its own
	         * class instead of an empty ChildrenNode.
	         */
	        if (this.priorityNode_) {
	            validatePriorityNode(this.priorityNode_);
	        }
	        if (this.children_.isEmpty()) {
	            assert(!this.priorityNode_ || this.priorityNode_.isEmpty(), 'An empty node cannot have a priority');
	        }
	    }
	    static get EMPTY_NODE() {
	        return (EMPTY_NODE ||
	            (EMPTY_NODE = new ChildrenNode(new SortedMap(NAME_COMPARATOR), null, IndexMap.Default)));
	    }
	    /** @inheritDoc */
	    isLeafNode() {
	        return false;
	    }
	    /** @inheritDoc */
	    getPriority() {
	        return this.priorityNode_ || EMPTY_NODE;
	    }
	    /** @inheritDoc */
	    updatePriority(newPriorityNode) {
	        if (this.children_.isEmpty()) {
	            // Don't allow priorities on empty nodes
	            return this;
	        }
	        else {
	            return new ChildrenNode(this.children_, newPriorityNode, this.indexMap_);
	        }
	    }
	    /** @inheritDoc */
	    getImmediateChild(childName) {
	        // Hack to treat priority as a regular child
	        if (childName === '.priority') {
	            return this.getPriority();
	        }
	        else {
	            const child = this.children_.get(childName);
	            return child === null ? EMPTY_NODE : child;
	        }
	    }
	    /** @inheritDoc */
	    getChild(path) {
	        const front = pathGetFront(path);
	        if (front === null) {
	            return this;
	        }
	        return this.getImmediateChild(front).getChild(pathPopFront(path));
	    }
	    /** @inheritDoc */
	    hasChild(childName) {
	        return this.children_.get(childName) !== null;
	    }
	    /** @inheritDoc */
	    updateImmediateChild(childName, newChildNode) {
	        assert(newChildNode, 'We should always be passing snapshot nodes');
	        if (childName === '.priority') {
	            return this.updatePriority(newChildNode);
	        }
	        else {
	            const namedNode = new NamedNode(childName, newChildNode);
	            let newChildren, newIndexMap;
	            if (newChildNode.isEmpty()) {
	                newChildren = this.children_.remove(childName);
	                newIndexMap = this.indexMap_.removeFromIndexes(namedNode, this.children_);
	            }
	            else {
	                newChildren = this.children_.insert(childName, newChildNode);
	                newIndexMap = this.indexMap_.addToIndexes(namedNode, this.children_);
	            }
	            const newPriority = newChildren.isEmpty()
	                ? EMPTY_NODE
	                : this.priorityNode_;
	            return new ChildrenNode(newChildren, newPriority, newIndexMap);
	        }
	    }
	    /** @inheritDoc */
	    updateChild(path, newChildNode) {
	        const front = pathGetFront(path);
	        if (front === null) {
	            return newChildNode;
	        }
	        else {
	            assert(pathGetFront(path) !== '.priority' || pathGetLength(path) === 1, '.priority must be the last token in a path');
	            const newImmediateChild = this.getImmediateChild(front).updateChild(pathPopFront(path), newChildNode);
	            return this.updateImmediateChild(front, newImmediateChild);
	        }
	    }
	    /** @inheritDoc */
	    isEmpty() {
	        return this.children_.isEmpty();
	    }
	    /** @inheritDoc */
	    numChildren() {
	        return this.children_.count();
	    }
	    /** @inheritDoc */
	    val(exportFormat) {
	        if (this.isEmpty()) {
	            return null;
	        }
	        const obj = {};
	        let numKeys = 0, maxKey = 0, allIntegerKeys = true;
	        this.forEachChild(PRIORITY_INDEX, (key, childNode) => {
	            obj[key] = childNode.val(exportFormat);
	            numKeys++;
	            if (allIntegerKeys && ChildrenNode.INTEGER_REGEXP_.test(key)) {
	                maxKey = Math.max(maxKey, Number(key));
	            }
	            else {
	                allIntegerKeys = false;
	            }
	        });
	        if (!exportFormat && allIntegerKeys && maxKey < 2 * numKeys) {
	            // convert to array.
	            const array = [];
	            // eslint-disable-next-line guard-for-in
	            for (const key in obj) {
	                array[key] = obj[key];
	            }
	            return array;
	        }
	        else {
	            if (exportFormat && !this.getPriority().isEmpty()) {
	                obj['.priority'] = this.getPriority().val();
	            }
	            return obj;
	        }
	    }
	    /** @inheritDoc */
	    hash() {
	        if (this.lazyHash_ === null) {
	            let toHash = '';
	            if (!this.getPriority().isEmpty()) {
	                toHash +=
	                    'priority:' +
	                        priorityHashText(this.getPriority().val()) +
	                        ':';
	            }
	            this.forEachChild(PRIORITY_INDEX, (key, childNode) => {
	                const childHash = childNode.hash();
	                if (childHash !== '') {
	                    toHash += ':' + key + ':' + childHash;
	                }
	            });
	            this.lazyHash_ = toHash === '' ? '' : sha1(toHash);
	        }
	        return this.lazyHash_;
	    }
	    /** @inheritDoc */
	    getPredecessorChildName(childName, childNode, index) {
	        const idx = this.resolveIndex_(index);
	        if (idx) {
	            const predecessor = idx.getPredecessorKey(new NamedNode(childName, childNode));
	            return predecessor ? predecessor.name : null;
	        }
	        else {
	            return this.children_.getPredecessorKey(childName);
	        }
	    }
	    getFirstChildName(indexDefinition) {
	        const idx = this.resolveIndex_(indexDefinition);
	        if (idx) {
	            const minKey = idx.minKey();
	            return minKey && minKey.name;
	        }
	        else {
	            return this.children_.minKey();
	        }
	    }
	    getFirstChild(indexDefinition) {
	        const minKey = this.getFirstChildName(indexDefinition);
	        if (minKey) {
	            return new NamedNode(minKey, this.children_.get(minKey));
	        }
	        else {
	            return null;
	        }
	    }
	    /**
	     * Given an index, return the key name of the largest value we have, according to that index
	     */
	    getLastChildName(indexDefinition) {
	        const idx = this.resolveIndex_(indexDefinition);
	        if (idx) {
	            const maxKey = idx.maxKey();
	            return maxKey && maxKey.name;
	        }
	        else {
	            return this.children_.maxKey();
	        }
	    }
	    getLastChild(indexDefinition) {
	        const maxKey = this.getLastChildName(indexDefinition);
	        if (maxKey) {
	            return new NamedNode(maxKey, this.children_.get(maxKey));
	        }
	        else {
	            return null;
	        }
	    }
	    forEachChild(index, action) {
	        const idx = this.resolveIndex_(index);
	        if (idx) {
	            return idx.inorderTraversal(wrappedNode => {
	                return action(wrappedNode.name, wrappedNode.node);
	            });
	        }
	        else {
	            return this.children_.inorderTraversal(action);
	        }
	    }
	    getIterator(indexDefinition) {
	        return this.getIteratorFrom(indexDefinition.minPost(), indexDefinition);
	    }
	    getIteratorFrom(startPost, indexDefinition) {
	        const idx = this.resolveIndex_(indexDefinition);
	        if (idx) {
	            return idx.getIteratorFrom(startPost, key => key);
	        }
	        else {
	            const iterator = this.children_.getIteratorFrom(startPost.name, NamedNode.Wrap);
	            let next = iterator.peek();
	            while (next != null && indexDefinition.compare(next, startPost) < 0) {
	                iterator.getNext();
	                next = iterator.peek();
	            }
	            return iterator;
	        }
	    }
	    getReverseIterator(indexDefinition) {
	        return this.getReverseIteratorFrom(indexDefinition.maxPost(), indexDefinition);
	    }
	    getReverseIteratorFrom(endPost, indexDefinition) {
	        const idx = this.resolveIndex_(indexDefinition);
	        if (idx) {
	            return idx.getReverseIteratorFrom(endPost, key => {
	                return key;
	            });
	        }
	        else {
	            const iterator = this.children_.getReverseIteratorFrom(endPost.name, NamedNode.Wrap);
	            let next = iterator.peek();
	            while (next != null && indexDefinition.compare(next, endPost) > 0) {
	                iterator.getNext();
	                next = iterator.peek();
	            }
	            return iterator;
	        }
	    }
	    compareTo(other) {
	        if (this.isEmpty()) {
	            if (other.isEmpty()) {
	                return 0;
	            }
	            else {
	                return -1;
	            }
	        }
	        else if (other.isLeafNode() || other.isEmpty()) {
	            return 1;
	        }
	        else if (other === MAX_NODE) {
	            return -1;
	        }
	        else {
	            // Must be another node with children.
	            return 0;
	        }
	    }
	    withIndex(indexDefinition) {
	        if (indexDefinition === KEY_INDEX ||
	            this.indexMap_.hasIndex(indexDefinition)) {
	            return this;
	        }
	        else {
	            const newIndexMap = this.indexMap_.addIndex(indexDefinition, this.children_);
	            return new ChildrenNode(this.children_, this.priorityNode_, newIndexMap);
	        }
	    }
	    isIndexed(index) {
	        return index === KEY_INDEX || this.indexMap_.hasIndex(index);
	    }
	    equals(other) {
	        if (other === this) {
	            return true;
	        }
	        else if (other.isLeafNode()) {
	            return false;
	        }
	        else {
	            const otherChildrenNode = other;
	            if (!this.getPriority().equals(otherChildrenNode.getPriority())) {
	                return false;
	            }
	            else if (this.children_.count() === otherChildrenNode.children_.count()) {
	                const thisIter = this.getIterator(PRIORITY_INDEX);
	                const otherIter = otherChildrenNode.getIterator(PRIORITY_INDEX);
	                let thisCurrent = thisIter.getNext();
	                let otherCurrent = otherIter.getNext();
	                while (thisCurrent && otherCurrent) {
	                    if (thisCurrent.name !== otherCurrent.name ||
	                        !thisCurrent.node.equals(otherCurrent.node)) {
	                        return false;
	                    }
	                    thisCurrent = thisIter.getNext();
	                    otherCurrent = otherIter.getNext();
	                }
	                return thisCurrent === null && otherCurrent === null;
	            }
	            else {
	                return false;
	            }
	        }
	    }
	    /**
	     * Returns a SortedMap ordered by index, or null if the default (by-key) ordering can be used
	     * instead.
	     *
	     */
	    resolveIndex_(indexDefinition) {
	        if (indexDefinition === KEY_INDEX) {
	            return null;
	        }
	        else {
	            return this.indexMap_.get(indexDefinition.toString());
	        }
	    }
	}
	ChildrenNode.INTEGER_REGEXP_ = /^(0|[1-9]\d*)$/;
	class MaxNode extends ChildrenNode {
	    constructor() {
	        super(new SortedMap(NAME_COMPARATOR), ChildrenNode.EMPTY_NODE, IndexMap.Default);
	    }
	    compareTo(other) {
	        if (other === this) {
	            return 0;
	        }
	        else {
	            return 1;
	        }
	    }
	    equals(other) {
	        // Not that we every compare it, but MAX_NODE is only ever equal to itself
	        return other === this;
	    }
	    getPriority() {
	        return this;
	    }
	    getImmediateChild(childName) {
	        return ChildrenNode.EMPTY_NODE;
	    }
	    isEmpty() {
	        return false;
	    }
	}
	/**
	 * Marker that will sort higher than any other snapshot.
	 */
	const MAX_NODE = new MaxNode();
	Object.defineProperties(NamedNode, {
	    MIN: {
	        value: new NamedNode(MIN_NAME, ChildrenNode.EMPTY_NODE)
	    },
	    MAX: {
	        value: new NamedNode(MAX_NAME, MAX_NODE)
	    }
	});
	/**
	 * Reference Extensions
	 */
	KeyIndex.__EMPTY_NODE = ChildrenNode.EMPTY_NODE;
	LeafNode.__childrenNodeConstructor = ChildrenNode;
	setMaxNode$1(MAX_NODE);
	setMaxNode(MAX_NODE);

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const USE_HINZE = true;
	/**
	 * Constructs a snapshot node representing the passed JSON and returns it.
	 * @param json - JSON to create a node for.
	 * @param priority - Optional priority to use.  This will be ignored if the
	 * passed JSON contains a .priority property.
	 */
	function nodeFromJSON(json, priority = null) {
	    if (json === null) {
	        return ChildrenNode.EMPTY_NODE;
	    }
	    if (typeof json === 'object' && '.priority' in json) {
	        priority = json['.priority'];
	    }
	    assert(priority === null ||
	        typeof priority === 'string' ||
	        typeof priority === 'number' ||
	        (typeof priority === 'object' && '.sv' in priority), 'Invalid priority type found: ' + typeof priority);
	    if (typeof json === 'object' && '.value' in json && json['.value'] !== null) {
	        json = json['.value'];
	    }
	    // Valid leaf nodes include non-objects or server-value wrapper objects
	    if (typeof json !== 'object' || '.sv' in json) {
	        const jsonLeaf = json;
	        return new LeafNode(jsonLeaf, nodeFromJSON(priority));
	    }
	    if (!(json instanceof Array) && USE_HINZE) {
	        const children = [];
	        let childrenHavePriority = false;
	        const hinzeJsonObj = json;
	        each(hinzeJsonObj, (key, child) => {
	            if (key.substring(0, 1) !== '.') {
	                // Ignore metadata nodes
	                const childNode = nodeFromJSON(child);
	                if (!childNode.isEmpty()) {
	                    childrenHavePriority =
	                        childrenHavePriority || !childNode.getPriority().isEmpty();
	                    children.push(new NamedNode(key, childNode));
	                }
	            }
	        });
	        if (children.length === 0) {
	            return ChildrenNode.EMPTY_NODE;
	        }
	        const childSet = buildChildSet(children, NAME_ONLY_COMPARATOR, namedNode => namedNode.name, NAME_COMPARATOR);
	        if (childrenHavePriority) {
	            const sortedChildSet = buildChildSet(children, PRIORITY_INDEX.getCompare());
	            return new ChildrenNode(childSet, nodeFromJSON(priority), new IndexMap({ '.priority': sortedChildSet }, { '.priority': PRIORITY_INDEX }));
	        }
	        else {
	            return new ChildrenNode(childSet, nodeFromJSON(priority), IndexMap.Default);
	        }
	    }
	    else {
	        let node = ChildrenNode.EMPTY_NODE;
	        each(json, (key, childData) => {
	            if (contains(json, key)) {
	                if (key.substring(0, 1) !== '.') {
	                    // ignore metadata nodes.
	                    const childNode = nodeFromJSON(childData);
	                    if (childNode.isLeafNode() || !childNode.isEmpty()) {
	                        node = node.updateImmediateChild(key, childNode);
	                    }
	                }
	            }
	        });
	        return node.updatePriority(nodeFromJSON(priority));
	    }
	}
	setNodeFromJSON(nodeFromJSON);

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class PathIndex extends Index {
	    constructor(indexPath_) {
	        super();
	        this.indexPath_ = indexPath_;
	        assert(!pathIsEmpty(indexPath_) && pathGetFront(indexPath_) !== '.priority', "Can't create PathIndex with empty path or .priority key");
	    }
	    extractChild(snap) {
	        return snap.getChild(this.indexPath_);
	    }
	    isDefinedOn(node) {
	        return !node.getChild(this.indexPath_).isEmpty();
	    }
	    compare(a, b) {
	        const aChild = this.extractChild(a.node);
	        const bChild = this.extractChild(b.node);
	        const indexCmp = aChild.compareTo(bChild);
	        if (indexCmp === 0) {
	            return nameCompare(a.name, b.name);
	        }
	        else {
	            return indexCmp;
	        }
	    }
	    makePost(indexValue, name) {
	        const valueNode = nodeFromJSON(indexValue);
	        const node = ChildrenNode.EMPTY_NODE.updateChild(this.indexPath_, valueNode);
	        return new NamedNode(name, node);
	    }
	    maxPost() {
	        const node = ChildrenNode.EMPTY_NODE.updateChild(this.indexPath_, MAX_NODE);
	        return new NamedNode(MAX_NAME, node);
	    }
	    toString() {
	        return pathSlice(this.indexPath_, 0).join('/');
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class ValueIndex extends Index {
	    compare(a, b) {
	        const indexCmp = a.node.compareTo(b.node);
	        if (indexCmp === 0) {
	            return nameCompare(a.name, b.name);
	        }
	        else {
	            return indexCmp;
	        }
	    }
	    isDefinedOn(node) {
	        return true;
	    }
	    indexedValueChanged(oldNode, newNode) {
	        return !oldNode.equals(newNode);
	    }
	    minPost() {
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        return NamedNode.MIN;
	    }
	    maxPost() {
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        return NamedNode.MAX;
	    }
	    makePost(indexValue, name) {
	        const valueNode = nodeFromJSON(indexValue);
	        return new NamedNode(name, valueNode);
	    }
	    /**
	     * @returns String representation for inclusion in a query spec
	     */
	    toString() {
	        return '.value';
	    }
	}
	const VALUE_INDEX = new ValueIndex();

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function changeValue(snapshotNode) {
	    return { type: "value" /* ChangeType.VALUE */, snapshotNode };
	}
	function changeChildAdded(childName, snapshotNode) {
	    return { type: "child_added" /* ChangeType.CHILD_ADDED */, snapshotNode, childName };
	}
	function changeChildRemoved(childName, snapshotNode) {
	    return { type: "child_removed" /* ChangeType.CHILD_REMOVED */, snapshotNode, childName };
	}
	function changeChildChanged(childName, snapshotNode, oldSnap) {
	    return {
	        type: "child_changed" /* ChangeType.CHILD_CHANGED */,
	        snapshotNode,
	        childName,
	        oldSnap
	    };
	}
	function changeChildMoved(childName, snapshotNode) {
	    return { type: "child_moved" /* ChangeType.CHILD_MOVED */, snapshotNode, childName };
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Doesn't really filter nodes but applies an index to the node and keeps track of any changes
	 */
	class IndexedFilter {
	    constructor(index_) {
	        this.index_ = index_;
	    }
	    updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator) {
	        assert(snap.isIndexed(this.index_), 'A node must be indexed if only a child is updated');
	        const oldChild = snap.getImmediateChild(key);
	        // Check if anything actually changed.
	        if (oldChild.getChild(affectedPath).equals(newChild.getChild(affectedPath))) {
	            // There's an edge case where a child can enter or leave the view because affectedPath was set to null.
	            // In this case, affectedPath will appear null in both the old and new snapshots.  So we need
	            // to avoid treating these cases as "nothing changed."
	            if (oldChild.isEmpty() === newChild.isEmpty()) {
	                // Nothing changed.
	                // This assert should be valid, but it's expensive (can dominate perf testing) so don't actually do it.
	                //assert(oldChild.equals(newChild), 'Old and new snapshots should be equal.');
	                return snap;
	            }
	        }
	        if (optChangeAccumulator != null) {
	            if (newChild.isEmpty()) {
	                if (snap.hasChild(key)) {
	                    optChangeAccumulator.trackChildChange(changeChildRemoved(key, oldChild));
	                }
	                else {
	                    assert(snap.isLeafNode(), 'A child remove without an old child only makes sense on a leaf node');
	                }
	            }
	            else if (oldChild.isEmpty()) {
	                optChangeAccumulator.trackChildChange(changeChildAdded(key, newChild));
	            }
	            else {
	                optChangeAccumulator.trackChildChange(changeChildChanged(key, newChild, oldChild));
	            }
	        }
	        if (snap.isLeafNode() && newChild.isEmpty()) {
	            return snap;
	        }
	        else {
	            // Make sure the node is indexed
	            return snap.updateImmediateChild(key, newChild).withIndex(this.index_);
	        }
	    }
	    updateFullNode(oldSnap, newSnap, optChangeAccumulator) {
	        if (optChangeAccumulator != null) {
	            if (!oldSnap.isLeafNode()) {
	                oldSnap.forEachChild(PRIORITY_INDEX, (key, childNode) => {
	                    if (!newSnap.hasChild(key)) {
	                        optChangeAccumulator.trackChildChange(changeChildRemoved(key, childNode));
	                    }
	                });
	            }
	            if (!newSnap.isLeafNode()) {
	                newSnap.forEachChild(PRIORITY_INDEX, (key, childNode) => {
	                    if (oldSnap.hasChild(key)) {
	                        const oldChild = oldSnap.getImmediateChild(key);
	                        if (!oldChild.equals(childNode)) {
	                            optChangeAccumulator.trackChildChange(changeChildChanged(key, childNode, oldChild));
	                        }
	                    }
	                    else {
	                        optChangeAccumulator.trackChildChange(changeChildAdded(key, childNode));
	                    }
	                });
	            }
	        }
	        return newSnap.withIndex(this.index_);
	    }
	    updatePriority(oldSnap, newPriority) {
	        if (oldSnap.isEmpty()) {
	            return ChildrenNode.EMPTY_NODE;
	        }
	        else {
	            return oldSnap.updatePriority(newPriority);
	        }
	    }
	    filtersNodes() {
	        return false;
	    }
	    getIndexedFilter() {
	        return this;
	    }
	    getIndex() {
	        return this.index_;
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Filters nodes by range and uses an IndexFilter to track any changes after filtering the node
	 */
	class RangedFilter {
	    constructor(params) {
	        this.indexedFilter_ = new IndexedFilter(params.getIndex());
	        this.index_ = params.getIndex();
	        this.startPost_ = RangedFilter.getStartPost_(params);
	        this.endPost_ = RangedFilter.getEndPost_(params);
	        this.startIsInclusive_ = !params.startAfterSet_;
	        this.endIsInclusive_ = !params.endBeforeSet_;
	    }
	    getStartPost() {
	        return this.startPost_;
	    }
	    getEndPost() {
	        return this.endPost_;
	    }
	    matches(node) {
	        const isWithinStart = this.startIsInclusive_
	            ? this.index_.compare(this.getStartPost(), node) <= 0
	            : this.index_.compare(this.getStartPost(), node) < 0;
	        const isWithinEnd = this.endIsInclusive_
	            ? this.index_.compare(node, this.getEndPost()) <= 0
	            : this.index_.compare(node, this.getEndPost()) < 0;
	        return isWithinStart && isWithinEnd;
	    }
	    updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator) {
	        if (!this.matches(new NamedNode(key, newChild))) {
	            newChild = ChildrenNode.EMPTY_NODE;
	        }
	        return this.indexedFilter_.updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator);
	    }
	    updateFullNode(oldSnap, newSnap, optChangeAccumulator) {
	        if (newSnap.isLeafNode()) {
	            // Make sure we have a children node with the correct index, not a leaf node;
	            newSnap = ChildrenNode.EMPTY_NODE;
	        }
	        let filtered = newSnap.withIndex(this.index_);
	        // Don't support priorities on queries
	        filtered = filtered.updatePriority(ChildrenNode.EMPTY_NODE);
	        const self = this;
	        newSnap.forEachChild(PRIORITY_INDEX, (key, childNode) => {
	            if (!self.matches(new NamedNode(key, childNode))) {
	                filtered = filtered.updateImmediateChild(key, ChildrenNode.EMPTY_NODE);
	            }
	        });
	        return this.indexedFilter_.updateFullNode(oldSnap, filtered, optChangeAccumulator);
	    }
	    updatePriority(oldSnap, newPriority) {
	        // Don't support priorities on queries
	        return oldSnap;
	    }
	    filtersNodes() {
	        return true;
	    }
	    getIndexedFilter() {
	        return this.indexedFilter_;
	    }
	    getIndex() {
	        return this.index_;
	    }
	    static getStartPost_(params) {
	        if (params.hasStart()) {
	            const startName = params.getIndexStartName();
	            return params.getIndex().makePost(params.getIndexStartValue(), startName);
	        }
	        else {
	            return params.getIndex().minPost();
	        }
	    }
	    static getEndPost_(params) {
	        if (params.hasEnd()) {
	            const endName = params.getIndexEndName();
	            return params.getIndex().makePost(params.getIndexEndValue(), endName);
	        }
	        else {
	            return params.getIndex().maxPost();
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Applies a limit and a range to a node and uses RangedFilter to do the heavy lifting where possible
	 */
	class LimitedFilter {
	    constructor(params) {
	        this.withinDirectionalStart = (node) => this.reverse_ ? this.withinEndPost(node) : this.withinStartPost(node);
	        this.withinDirectionalEnd = (node) => this.reverse_ ? this.withinStartPost(node) : this.withinEndPost(node);
	        this.withinStartPost = (node) => {
	            const compareRes = this.index_.compare(this.rangedFilter_.getStartPost(), node);
	            return this.startIsInclusive_ ? compareRes <= 0 : compareRes < 0;
	        };
	        this.withinEndPost = (node) => {
	            const compareRes = this.index_.compare(node, this.rangedFilter_.getEndPost());
	            return this.endIsInclusive_ ? compareRes <= 0 : compareRes < 0;
	        };
	        this.rangedFilter_ = new RangedFilter(params);
	        this.index_ = params.getIndex();
	        this.limit_ = params.getLimit();
	        this.reverse_ = !params.isViewFromLeft();
	        this.startIsInclusive_ = !params.startAfterSet_;
	        this.endIsInclusive_ = !params.endBeforeSet_;
	    }
	    updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator) {
	        if (!this.rangedFilter_.matches(new NamedNode(key, newChild))) {
	            newChild = ChildrenNode.EMPTY_NODE;
	        }
	        if (snap.getImmediateChild(key).equals(newChild)) {
	            // No change
	            return snap;
	        }
	        else if (snap.numChildren() < this.limit_) {
	            return this.rangedFilter_
	                .getIndexedFilter()
	                .updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator);
	        }
	        else {
	            return this.fullLimitUpdateChild_(snap, key, newChild, source, optChangeAccumulator);
	        }
	    }
	    updateFullNode(oldSnap, newSnap, optChangeAccumulator) {
	        let filtered;
	        if (newSnap.isLeafNode() || newSnap.isEmpty()) {
	            // Make sure we have a children node with the correct index, not a leaf node;
	            filtered = ChildrenNode.EMPTY_NODE.withIndex(this.index_);
	        }
	        else {
	            if (this.limit_ * 2 < newSnap.numChildren() &&
	                newSnap.isIndexed(this.index_)) {
	                // Easier to build up a snapshot, since what we're given has more than twice the elements we want
	                filtered = ChildrenNode.EMPTY_NODE.withIndex(this.index_);
	                // anchor to the startPost, endPost, or last element as appropriate
	                let iterator;
	                if (this.reverse_) {
	                    iterator = newSnap.getReverseIteratorFrom(this.rangedFilter_.getEndPost(), this.index_);
	                }
	                else {
	                    iterator = newSnap.getIteratorFrom(this.rangedFilter_.getStartPost(), this.index_);
	                }
	                let count = 0;
	                while (iterator.hasNext() && count < this.limit_) {
	                    const next = iterator.getNext();
	                    if (!this.withinDirectionalStart(next)) {
	                        // if we have not reached the start, skip to the next element
	                        continue;
	                    }
	                    else if (!this.withinDirectionalEnd(next)) {
	                        // if we have reached the end, stop adding elements
	                        break;
	                    }
	                    else {
	                        filtered = filtered.updateImmediateChild(next.name, next.node);
	                        count++;
	                    }
	                }
	            }
	            else {
	                // The snap contains less than twice the limit. Faster to delete from the snap than build up a new one
	                filtered = newSnap.withIndex(this.index_);
	                // Don't support priorities on queries
	                filtered = filtered.updatePriority(ChildrenNode.EMPTY_NODE);
	                let iterator;
	                if (this.reverse_) {
	                    iterator = filtered.getReverseIterator(this.index_);
	                }
	                else {
	                    iterator = filtered.getIterator(this.index_);
	                }
	                let count = 0;
	                while (iterator.hasNext()) {
	                    const next = iterator.getNext();
	                    const inRange = count < this.limit_ &&
	                        this.withinDirectionalStart(next) &&
	                        this.withinDirectionalEnd(next);
	                    if (inRange) {
	                        count++;
	                    }
	                    else {
	                        filtered = filtered.updateImmediateChild(next.name, ChildrenNode.EMPTY_NODE);
	                    }
	                }
	            }
	        }
	        return this.rangedFilter_
	            .getIndexedFilter()
	            .updateFullNode(oldSnap, filtered, optChangeAccumulator);
	    }
	    updatePriority(oldSnap, newPriority) {
	        // Don't support priorities on queries
	        return oldSnap;
	    }
	    filtersNodes() {
	        return true;
	    }
	    getIndexedFilter() {
	        return this.rangedFilter_.getIndexedFilter();
	    }
	    getIndex() {
	        return this.index_;
	    }
	    fullLimitUpdateChild_(snap, childKey, childSnap, source, changeAccumulator) {
	        // TODO: rename all cache stuff etc to general snap terminology
	        let cmp;
	        if (this.reverse_) {
	            const indexCmp = this.index_.getCompare();
	            cmp = (a, b) => indexCmp(b, a);
	        }
	        else {
	            cmp = this.index_.getCompare();
	        }
	        const oldEventCache = snap;
	        assert(oldEventCache.numChildren() === this.limit_, '');
	        const newChildNamedNode = new NamedNode(childKey, childSnap);
	        const windowBoundary = this.reverse_
	            ? oldEventCache.getFirstChild(this.index_)
	            : oldEventCache.getLastChild(this.index_);
	        const inRange = this.rangedFilter_.matches(newChildNamedNode);
	        if (oldEventCache.hasChild(childKey)) {
	            const oldChildSnap = oldEventCache.getImmediateChild(childKey);
	            let nextChild = source.getChildAfterChild(this.index_, windowBoundary, this.reverse_);
	            while (nextChild != null &&
	                (nextChild.name === childKey || oldEventCache.hasChild(nextChild.name))) {
	                // There is a weird edge case where a node is updated as part of a merge in the write tree, but hasn't
	                // been applied to the limited filter yet. Ignore this next child which will be updated later in
	                // the limited filter...
	                nextChild = source.getChildAfterChild(this.index_, nextChild, this.reverse_);
	            }
	            const compareNext = nextChild == null ? 1 : cmp(nextChild, newChildNamedNode);
	            const remainsInWindow = inRange && !childSnap.isEmpty() && compareNext >= 0;
	            if (remainsInWindow) {
	                if (changeAccumulator != null) {
	                    changeAccumulator.trackChildChange(changeChildChanged(childKey, childSnap, oldChildSnap));
	                }
	                return oldEventCache.updateImmediateChild(childKey, childSnap);
	            }
	            else {
	                if (changeAccumulator != null) {
	                    changeAccumulator.trackChildChange(changeChildRemoved(childKey, oldChildSnap));
	                }
	                const newEventCache = oldEventCache.updateImmediateChild(childKey, ChildrenNode.EMPTY_NODE);
	                const nextChildInRange = nextChild != null && this.rangedFilter_.matches(nextChild);
	                if (nextChildInRange) {
	                    if (changeAccumulator != null) {
	                        changeAccumulator.trackChildChange(changeChildAdded(nextChild.name, nextChild.node));
	                    }
	                    return newEventCache.updateImmediateChild(nextChild.name, nextChild.node);
	                }
	                else {
	                    return newEventCache;
	                }
	            }
	        }
	        else if (childSnap.isEmpty()) {
	            // we're deleting a node, but it was not in the window, so ignore it
	            return snap;
	        }
	        else if (inRange) {
	            if (cmp(windowBoundary, newChildNamedNode) >= 0) {
	                if (changeAccumulator != null) {
	                    changeAccumulator.trackChildChange(changeChildRemoved(windowBoundary.name, windowBoundary.node));
	                    changeAccumulator.trackChildChange(changeChildAdded(childKey, childSnap));
	                }
	                return oldEventCache
	                    .updateImmediateChild(childKey, childSnap)
	                    .updateImmediateChild(windowBoundary.name, ChildrenNode.EMPTY_NODE);
	            }
	            else {
	                return snap;
	            }
	        }
	        else {
	            return snap;
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * This class is an immutable-from-the-public-api struct containing a set of query parameters defining a
	 * range to be returned for a particular location. It is assumed that validation of parameters is done at the
	 * user-facing API level, so it is not done here.
	 *
	 * @internal
	 */
	class QueryParams {
	    constructor() {
	        this.limitSet_ = false;
	        this.startSet_ = false;
	        this.startNameSet_ = false;
	        this.startAfterSet_ = false; // can only be true if startSet_ is true
	        this.endSet_ = false;
	        this.endNameSet_ = false;
	        this.endBeforeSet_ = false; // can only be true if endSet_ is true
	        this.limit_ = 0;
	        this.viewFrom_ = '';
	        this.indexStartValue_ = null;
	        this.indexStartName_ = '';
	        this.indexEndValue_ = null;
	        this.indexEndName_ = '';
	        this.index_ = PRIORITY_INDEX;
	    }
	    hasStart() {
	        return this.startSet_;
	    }
	    /**
	     * @returns True if it would return from left.
	     */
	    isViewFromLeft() {
	        if (this.viewFrom_ === '') {
	            // limit(), rather than limitToFirst or limitToLast was called.
	            // This means that only one of startSet_ and endSet_ is true. Use them
	            // to calculate which side of the view to anchor to. If neither is set,
	            // anchor to the end.
	            return this.startSet_;
	        }
	        else {
	            return this.viewFrom_ === "l" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM_LEFT */;
	        }
	    }
	    /**
	     * Only valid to call if hasStart() returns true
	     */
	    getIndexStartValue() {
	        assert(this.startSet_, 'Only valid if start has been set');
	        return this.indexStartValue_;
	    }
	    /**
	     * Only valid to call if hasStart() returns true.
	     * Returns the starting key name for the range defined by these query parameters
	     */
	    getIndexStartName() {
	        assert(this.startSet_, 'Only valid if start has been set');
	        if (this.startNameSet_) {
	            return this.indexStartName_;
	        }
	        else {
	            return MIN_NAME;
	        }
	    }
	    hasEnd() {
	        return this.endSet_;
	    }
	    /**
	     * Only valid to call if hasEnd() returns true.
	     */
	    getIndexEndValue() {
	        assert(this.endSet_, 'Only valid if end has been set');
	        return this.indexEndValue_;
	    }
	    /**
	     * Only valid to call if hasEnd() returns true.
	     * Returns the end key name for the range defined by these query parameters
	     */
	    getIndexEndName() {
	        assert(this.endSet_, 'Only valid if end has been set');
	        if (this.endNameSet_) {
	            return this.indexEndName_;
	        }
	        else {
	            return MAX_NAME;
	        }
	    }
	    hasLimit() {
	        return this.limitSet_;
	    }
	    /**
	     * @returns True if a limit has been set and it has been explicitly anchored
	     */
	    hasAnchoredLimit() {
	        return this.limitSet_ && this.viewFrom_ !== '';
	    }
	    /**
	     * Only valid to call if hasLimit() returns true
	     */
	    getLimit() {
	        assert(this.limitSet_, 'Only valid if limit has been set');
	        return this.limit_;
	    }
	    getIndex() {
	        return this.index_;
	    }
	    loadsAllData() {
	        return !(this.startSet_ || this.endSet_ || this.limitSet_);
	    }
	    isDefault() {
	        return this.loadsAllData() && this.index_ === PRIORITY_INDEX;
	    }
	    copy() {
	        const copy = new QueryParams();
	        copy.limitSet_ = this.limitSet_;
	        copy.limit_ = this.limit_;
	        copy.startSet_ = this.startSet_;
	        copy.startAfterSet_ = this.startAfterSet_;
	        copy.indexStartValue_ = this.indexStartValue_;
	        copy.startNameSet_ = this.startNameSet_;
	        copy.indexStartName_ = this.indexStartName_;
	        copy.endSet_ = this.endSet_;
	        copy.endBeforeSet_ = this.endBeforeSet_;
	        copy.indexEndValue_ = this.indexEndValue_;
	        copy.endNameSet_ = this.endNameSet_;
	        copy.indexEndName_ = this.indexEndName_;
	        copy.index_ = this.index_;
	        copy.viewFrom_ = this.viewFrom_;
	        return copy;
	    }
	}
	function queryParamsGetNodeFilter(queryParams) {
	    if (queryParams.loadsAllData()) {
	        return new IndexedFilter(queryParams.getIndex());
	    }
	    else if (queryParams.hasLimit()) {
	        return new LimitedFilter(queryParams);
	    }
	    else {
	        return new RangedFilter(queryParams);
	    }
	}
	/**
	 * Returns a set of REST query string parameters representing this query.
	 *
	 * @returns query string parameters
	 */
	function queryParamsToRestQueryStringParameters(queryParams) {
	    const qs = {};
	    if (queryParams.isDefault()) {
	        return qs;
	    }
	    let orderBy;
	    if (queryParams.index_ === PRIORITY_INDEX) {
	        orderBy = "$priority" /* REST_QUERY_CONSTANTS.PRIORITY_INDEX */;
	    }
	    else if (queryParams.index_ === VALUE_INDEX) {
	        orderBy = "$value" /* REST_QUERY_CONSTANTS.VALUE_INDEX */;
	    }
	    else if (queryParams.index_ === KEY_INDEX) {
	        orderBy = "$key" /* REST_QUERY_CONSTANTS.KEY_INDEX */;
	    }
	    else {
	        assert(queryParams.index_ instanceof PathIndex, 'Unrecognized index type!');
	        orderBy = queryParams.index_.toString();
	    }
	    qs["orderBy" /* REST_QUERY_CONSTANTS.ORDER_BY */] = stringify(orderBy);
	    if (queryParams.startSet_) {
	        const startParam = queryParams.startAfterSet_
	            ? "startAfter" /* REST_QUERY_CONSTANTS.START_AFTER */
	            : "startAt" /* REST_QUERY_CONSTANTS.START_AT */;
	        qs[startParam] = stringify(queryParams.indexStartValue_);
	        if (queryParams.startNameSet_) {
	            qs[startParam] += ',' + stringify(queryParams.indexStartName_);
	        }
	    }
	    if (queryParams.endSet_) {
	        const endParam = queryParams.endBeforeSet_
	            ? "endBefore" /* REST_QUERY_CONSTANTS.END_BEFORE */
	            : "endAt" /* REST_QUERY_CONSTANTS.END_AT */;
	        qs[endParam] = stringify(queryParams.indexEndValue_);
	        if (queryParams.endNameSet_) {
	            qs[endParam] += ',' + stringify(queryParams.indexEndName_);
	        }
	    }
	    if (queryParams.limitSet_) {
	        if (queryParams.isViewFromLeft()) {
	            qs["limitToFirst" /* REST_QUERY_CONSTANTS.LIMIT_TO_FIRST */] = queryParams.limit_;
	        }
	        else {
	            qs["limitToLast" /* REST_QUERY_CONSTANTS.LIMIT_TO_LAST */] = queryParams.limit_;
	        }
	    }
	    return qs;
	}
	function queryParamsGetQueryObject(queryParams) {
	    const obj = {};
	    if (queryParams.startSet_) {
	        obj["sp" /* WIRE_PROTOCOL_CONSTANTS.INDEX_START_VALUE */] =
	            queryParams.indexStartValue_;
	        if (queryParams.startNameSet_) {
	            obj["sn" /* WIRE_PROTOCOL_CONSTANTS.INDEX_START_NAME */] =
	                queryParams.indexStartName_;
	        }
	        obj["sin" /* WIRE_PROTOCOL_CONSTANTS.INDEX_START_IS_INCLUSIVE */] =
	            !queryParams.startAfterSet_;
	    }
	    if (queryParams.endSet_) {
	        obj["ep" /* WIRE_PROTOCOL_CONSTANTS.INDEX_END_VALUE */] = queryParams.indexEndValue_;
	        if (queryParams.endNameSet_) {
	            obj["en" /* WIRE_PROTOCOL_CONSTANTS.INDEX_END_NAME */] = queryParams.indexEndName_;
	        }
	        obj["ein" /* WIRE_PROTOCOL_CONSTANTS.INDEX_END_IS_INCLUSIVE */] =
	            !queryParams.endBeforeSet_;
	    }
	    if (queryParams.limitSet_) {
	        obj["l" /* WIRE_PROTOCOL_CONSTANTS.LIMIT */] = queryParams.limit_;
	        let viewFrom = queryParams.viewFrom_;
	        if (viewFrom === '') {
	            if (queryParams.isViewFromLeft()) {
	                viewFrom = "l" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM_LEFT */;
	            }
	            else {
	                viewFrom = "r" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM_RIGHT */;
	            }
	        }
	        obj["vf" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM */] = viewFrom;
	    }
	    // For now, priority index is the default, so we only specify if it's some other index
	    if (queryParams.index_ !== PRIORITY_INDEX) {
	        obj["i" /* WIRE_PROTOCOL_CONSTANTS.INDEX */] = queryParams.index_.toString();
	    }
	    return obj;
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * An implementation of ServerActions that communicates with the server via REST requests.
	 * This is mostly useful for compatibility with crawlers, where we don't want to spin up a full
	 * persistent connection (using WebSockets or long-polling)
	 */
	class ReadonlyRestClient extends ServerActions {
	    /**
	     * @param repoInfo_ - Data about the namespace we are connecting to
	     * @param onDataUpdate_ - A callback for new data from the server
	     */
	    constructor(repoInfo_, onDataUpdate_, authTokenProvider_, appCheckTokenProvider_) {
	        super();
	        this.repoInfo_ = repoInfo_;
	        this.onDataUpdate_ = onDataUpdate_;
	        this.authTokenProvider_ = authTokenProvider_;
	        this.appCheckTokenProvider_ = appCheckTokenProvider_;
	        /** @private {function(...[*])} */
	        this.log_ = logWrapper('p:rest:');
	        /**
	         * We don't actually need to track listens, except to prevent us calling an onComplete for a listen
	         * that's been removed. :-/
	         */
	        this.listens_ = {};
	    }
	    reportStats(stats) {
	        throw new Error('Method not implemented.');
	    }
	    static getListenId_(query, tag) {
	        if (tag !== undefined) {
	            return 'tag$' + tag;
	        }
	        else {
	            assert(query._queryParams.isDefault(), "should have a tag if it's not a default query.");
	            return query._path.toString();
	        }
	    }
	    /** @inheritDoc */
	    listen(query, currentHashFn, tag, onComplete) {
	        const pathString = query._path.toString();
	        this.log_('Listen called for ' + pathString + ' ' + query._queryIdentifier);
	        // Mark this listener so we can tell if it's removed.
	        const listenId = ReadonlyRestClient.getListenId_(query, tag);
	        const thisListen = {};
	        this.listens_[listenId] = thisListen;
	        const queryStringParameters = queryParamsToRestQueryStringParameters(query._queryParams);
	        this.restRequest_(pathString + '.json', queryStringParameters, (error, result) => {
	            let data = result;
	            if (error === 404) {
	                data = null;
	                error = null;
	            }
	            if (error === null) {
	                this.onDataUpdate_(pathString, data, /*isMerge=*/ false, tag);
	            }
	            if (safeGet(this.listens_, listenId) === thisListen) {
	                let status;
	                if (!error) {
	                    status = 'ok';
	                }
	                else if (error === 401) {
	                    status = 'permission_denied';
	                }
	                else {
	                    status = 'rest_error:' + error;
	                }
	                onComplete(status, null);
	            }
	        });
	    }
	    /** @inheritDoc */
	    unlisten(query, tag) {
	        const listenId = ReadonlyRestClient.getListenId_(query, tag);
	        delete this.listens_[listenId];
	    }
	    get(query) {
	        const queryStringParameters = queryParamsToRestQueryStringParameters(query._queryParams);
	        const pathString = query._path.toString();
	        const deferred = new Deferred();
	        this.restRequest_(pathString + '.json', queryStringParameters, (error, result) => {
	            let data = result;
	            if (error === 404) {
	                data = null;
	                error = null;
	            }
	            if (error === null) {
	                this.onDataUpdate_(pathString, data, 
	                /*isMerge=*/ false, 
	                /*tag=*/ null);
	                deferred.resolve(data);
	            }
	            else {
	                deferred.reject(new Error(data));
	            }
	        });
	        return deferred.promise;
	    }
	    /** @inheritDoc */
	    refreshAuthToken(token) {
	        // no-op since we just always call getToken.
	    }
	    /**
	     * Performs a REST request to the given path, with the provided query string parameters,
	     * and any auth credentials we have.
	     */
	    restRequest_(pathString, queryStringParameters = {}, callback) {
	        queryStringParameters['format'] = 'export';
	        return Promise.all([
	            this.authTokenProvider_.getToken(/*forceRefresh=*/ false),
	            this.appCheckTokenProvider_.getToken(/*forceRefresh=*/ false)
	        ]).then(([authToken, appCheckToken]) => {
	            if (authToken && authToken.accessToken) {
	                queryStringParameters['auth'] = authToken.accessToken;
	            }
	            if (appCheckToken && appCheckToken.token) {
	                queryStringParameters['ac'] = appCheckToken.token;
	            }
	            const url = (this.repoInfo_.secure ? 'https://' : 'http://') +
	                this.repoInfo_.host +
	                pathString +
	                '?' +
	                'ns=' +
	                this.repoInfo_.namespace +
	                querystring(queryStringParameters);
	            this.log_('Sending REST request for ' + url);
	            const xhr = new XMLHttpRequest();
	            xhr.onreadystatechange = () => {
	                if (callback && xhr.readyState === 4) {
	                    this.log_('REST Response for ' + url + ' received. status:', xhr.status, 'response:', xhr.responseText);
	                    let res = null;
	                    if (xhr.status >= 200 && xhr.status < 300) {
	                        try {
	                            res = jsonEval(xhr.responseText);
	                        }
	                        catch (e) {
	                            warn('Failed to parse JSON response for ' +
	                                url +
	                                ': ' +
	                                xhr.responseText);
	                        }
	                        callback(null, res);
	                    }
	                    else {
	                        // 401 and 404 are expected.
	                        if (xhr.status !== 401 && xhr.status !== 404) {
	                            warn('Got unsuccessful REST response for ' +
	                                url +
	                                ' Status: ' +
	                                xhr.status);
	                        }
	                        callback(xhr.status);
	                    }
	                    callback = null;
	                }
	            };
	            xhr.open('GET', url, /*asynchronous=*/ true);
	            xhr.send();
	        });
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Mutable object which basically just stores a reference to the "latest" immutable snapshot.
	 */
	class SnapshotHolder {
	    constructor() {
	        this.rootNode_ = ChildrenNode.EMPTY_NODE;
	    }
	    getNode(path) {
	        return this.rootNode_.getChild(path);
	    }
	    updateSnapshot(path, newSnapshotNode) {
	        this.rootNode_ = this.rootNode_.updateChild(path, newSnapshotNode);
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function newSparseSnapshotTree() {
	    return {
	        value: null,
	        children: new Map()
	    };
	}
	/**
	 * Stores the given node at the specified path. If there is already a node
	 * at a shallower path, it merges the new data into that snapshot node.
	 *
	 * @param path - Path to look up snapshot for.
	 * @param data - The new data, or null.
	 */
	function sparseSnapshotTreeRemember(sparseSnapshotTree, path, data) {
	    if (pathIsEmpty(path)) {
	        sparseSnapshotTree.value = data;
	        sparseSnapshotTree.children.clear();
	    }
	    else if (sparseSnapshotTree.value !== null) {
	        sparseSnapshotTree.value = sparseSnapshotTree.value.updateChild(path, data);
	    }
	    else {
	        const childKey = pathGetFront(path);
	        if (!sparseSnapshotTree.children.has(childKey)) {
	            sparseSnapshotTree.children.set(childKey, newSparseSnapshotTree());
	        }
	        const child = sparseSnapshotTree.children.get(childKey);
	        path = pathPopFront(path);
	        sparseSnapshotTreeRemember(child, path, data);
	    }
	}
	/**
	 * Recursively iterates through all of the stored tree and calls the
	 * callback on each one.
	 *
	 * @param prefixPath - Path to look up node for.
	 * @param func - The function to invoke for each tree.
	 */
	function sparseSnapshotTreeForEachTree(sparseSnapshotTree, prefixPath, func) {
	    if (sparseSnapshotTree.value !== null) {
	        func(prefixPath, sparseSnapshotTree.value);
	    }
	    else {
	        sparseSnapshotTreeForEachChild(sparseSnapshotTree, (key, tree) => {
	            const path = new Path(prefixPath.toString() + '/' + key);
	            sparseSnapshotTreeForEachTree(tree, path, func);
	        });
	    }
	}
	/**
	 * Iterates through each immediate child and triggers the callback.
	 * Only seems to be used in tests.
	 *
	 * @param func - The function to invoke for each child.
	 */
	function sparseSnapshotTreeForEachChild(sparseSnapshotTree, func) {
	    sparseSnapshotTree.children.forEach((tree, key) => {
	        func(key, tree);
	    });
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Returns the delta from the previous call to get stats.
	 *
	 * @param collection_ - The collection to "listen" to.
	 */
	class StatsListener {
	    constructor(collection_) {
	        this.collection_ = collection_;
	        this.last_ = null;
	    }
	    get() {
	        const newStats = this.collection_.get();
	        const delta = Object.assign({}, newStats);
	        if (this.last_) {
	            each(this.last_, (stat, value) => {
	                delta[stat] = delta[stat] - value;
	            });
	        }
	        this.last_ = newStats;
	        return delta;
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	// Assuming some apps may have a short amount of time on page, and a bulk of firebase operations probably
	// happen on page load, we try to report our first set of stats pretty quickly, but we wait at least 10
	// seconds to try to ensure the Firebase connection is established / settled.
	const FIRST_STATS_MIN_TIME = 10 * 1000;
	const FIRST_STATS_MAX_TIME = 30 * 1000;
	// We'll continue to report stats on average every 5 minutes.
	const REPORT_STATS_INTERVAL = 5 * 60 * 1000;
	class StatsReporter {
	    constructor(collection, server_) {
	        this.server_ = server_;
	        this.statsToReport_ = {};
	        this.statsListener_ = new StatsListener(collection);
	        const timeout = FIRST_STATS_MIN_TIME +
	            (FIRST_STATS_MAX_TIME - FIRST_STATS_MIN_TIME) * Math.random();
	        setTimeoutNonBlocking(this.reportStats_.bind(this), Math.floor(timeout));
	    }
	    reportStats_() {
	        const stats = this.statsListener_.get();
	        const reportedStats = {};
	        let haveStatsToReport = false;
	        each(stats, (stat, value) => {
	            if (value > 0 && contains(this.statsToReport_, stat)) {
	                reportedStats[stat] = value;
	                haveStatsToReport = true;
	            }
	        });
	        if (haveStatsToReport) {
	            this.server_.reportStats(reportedStats);
	        }
	        // queue our next run.
	        setTimeoutNonBlocking(this.reportStats_.bind(this), Math.floor(Math.random() * 2 * REPORT_STATS_INTERVAL));
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 *
	 * @enum
	 */
	var OperationType;
	(function (OperationType) {
	    OperationType[OperationType["OVERWRITE"] = 0] = "OVERWRITE";
	    OperationType[OperationType["MERGE"] = 1] = "MERGE";
	    OperationType[OperationType["ACK_USER_WRITE"] = 2] = "ACK_USER_WRITE";
	    OperationType[OperationType["LISTEN_COMPLETE"] = 3] = "LISTEN_COMPLETE";
	})(OperationType || (OperationType = {}));
	function newOperationSourceUser() {
	    return {
	        fromUser: true,
	        fromServer: false,
	        queryId: null,
	        tagged: false
	    };
	}
	function newOperationSourceServer() {
	    return {
	        fromUser: false,
	        fromServer: true,
	        queryId: null,
	        tagged: false
	    };
	}
	function newOperationSourceServerTaggedQuery(queryId) {
	    return {
	        fromUser: false,
	        fromServer: true,
	        queryId,
	        tagged: true
	    };
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class AckUserWrite {
	    /**
	     * @param affectedTree - A tree containing true for each affected path. Affected paths can't overlap.
	     */
	    constructor(
	    /** @inheritDoc */ path, 
	    /** @inheritDoc */ affectedTree, 
	    /** @inheritDoc */ revert) {
	        this.path = path;
	        this.affectedTree = affectedTree;
	        this.revert = revert;
	        /** @inheritDoc */
	        this.type = OperationType.ACK_USER_WRITE;
	        /** @inheritDoc */
	        this.source = newOperationSourceUser();
	    }
	    operationForChild(childName) {
	        if (!pathIsEmpty(this.path)) {
	            assert(pathGetFront(this.path) === childName, 'operationForChild called for unrelated child.');
	            return new AckUserWrite(pathPopFront(this.path), this.affectedTree, this.revert);
	        }
	        else if (this.affectedTree.value != null) {
	            assert(this.affectedTree.children.isEmpty(), 'affectedTree should not have overlapping affected paths.');
	            // All child locations are affected as well; just return same operation.
	            return this;
	        }
	        else {
	            const childTree = this.affectedTree.subtree(new Path(childName));
	            return new AckUserWrite(newEmptyPath(), childTree, this.revert);
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class ListenComplete {
	    constructor(source, path) {
	        this.source = source;
	        this.path = path;
	        /** @inheritDoc */
	        this.type = OperationType.LISTEN_COMPLETE;
	    }
	    operationForChild(childName) {
	        if (pathIsEmpty(this.path)) {
	            return new ListenComplete(this.source, newEmptyPath());
	        }
	        else {
	            return new ListenComplete(this.source, pathPopFront(this.path));
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class Overwrite {
	    constructor(source, path, snap) {
	        this.source = source;
	        this.path = path;
	        this.snap = snap;
	        /** @inheritDoc */
	        this.type = OperationType.OVERWRITE;
	    }
	    operationForChild(childName) {
	        if (pathIsEmpty(this.path)) {
	            return new Overwrite(this.source, newEmptyPath(), this.snap.getImmediateChild(childName));
	        }
	        else {
	            return new Overwrite(this.source, pathPopFront(this.path), this.snap);
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class Merge {
	    constructor(
	    /** @inheritDoc */ source, 
	    /** @inheritDoc */ path, 
	    /** @inheritDoc */ children) {
	        this.source = source;
	        this.path = path;
	        this.children = children;
	        /** @inheritDoc */
	        this.type = OperationType.MERGE;
	    }
	    operationForChild(childName) {
	        if (pathIsEmpty(this.path)) {
	            const childTree = this.children.subtree(new Path(childName));
	            if (childTree.isEmpty()) {
	                // This child is unaffected
	                return null;
	            }
	            else if (childTree.value) {
	                // We have a snapshot for the child in question.  This becomes an overwrite of the child.
	                return new Overwrite(this.source, newEmptyPath(), childTree.value);
	            }
	            else {
	                // This is a merge at a deeper level
	                return new Merge(this.source, newEmptyPath(), childTree);
	            }
	        }
	        else {
	            assert(pathGetFront(this.path) === childName, "Can't get a merge for a child not on the path of the operation");
	            return new Merge(this.source, pathPopFront(this.path), this.children);
	        }
	    }
	    toString() {
	        return ('Operation(' +
	            this.path +
	            ': ' +
	            this.source.toString() +
	            ' merge: ' +
	            this.children.toString() +
	            ')');
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * A cache node only stores complete children. Additionally it holds a flag whether the node can be considered fully
	 * initialized in the sense that we know at one point in time this represented a valid state of the world, e.g.
	 * initialized with data from the server, or a complete overwrite by the client. The filtered flag also tracks
	 * whether a node potentially had children removed due to a filter.
	 */
	class CacheNode {
	    constructor(node_, fullyInitialized_, filtered_) {
	        this.node_ = node_;
	        this.fullyInitialized_ = fullyInitialized_;
	        this.filtered_ = filtered_;
	    }
	    /**
	     * Returns whether this node was fully initialized with either server data or a complete overwrite by the client
	     */
	    isFullyInitialized() {
	        return this.fullyInitialized_;
	    }
	    /**
	     * Returns whether this node is potentially missing children due to a filter applied to the node
	     */
	    isFiltered() {
	        return this.filtered_;
	    }
	    isCompleteForPath(path) {
	        if (pathIsEmpty(path)) {
	            return this.isFullyInitialized() && !this.filtered_;
	        }
	        const childKey = pathGetFront(path);
	        return this.isCompleteForChild(childKey);
	    }
	    isCompleteForChild(key) {
	        return ((this.isFullyInitialized() && !this.filtered_) || this.node_.hasChild(key));
	    }
	    getNode() {
	        return this.node_;
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * An EventGenerator is used to convert "raw" changes (Change) as computed by the
	 * CacheDiffer into actual events (Event) that can be raised.  See generateEventsForChanges()
	 * for details.
	 *
	 */
	class EventGenerator {
	    constructor(query_) {
	        this.query_ = query_;
	        this.index_ = this.query_._queryParams.getIndex();
	    }
	}
	/**
	 * Given a set of raw changes (no moved events and prevName not specified yet), and a set of
	 * EventRegistrations that should be notified of these changes, generate the actual events to be raised.
	 *
	 * Notes:
	 *  - child_moved events will be synthesized at this time for any child_changed events that affect
	 *    our index.
	 *  - prevName will be calculated based on the index ordering.
	 */
	function eventGeneratorGenerateEventsForChanges(eventGenerator, changes, eventCache, eventRegistrations) {
	    const events = [];
	    const moves = [];
	    changes.forEach(change => {
	        if (change.type === "child_changed" /* ChangeType.CHILD_CHANGED */ &&
	            eventGenerator.index_.indexedValueChanged(change.oldSnap, change.snapshotNode)) {
	            moves.push(changeChildMoved(change.childName, change.snapshotNode));
	        }
	    });
	    eventGeneratorGenerateEventsForType(eventGenerator, events, "child_removed" /* ChangeType.CHILD_REMOVED */, changes, eventRegistrations, eventCache);
	    eventGeneratorGenerateEventsForType(eventGenerator, events, "child_added" /* ChangeType.CHILD_ADDED */, changes, eventRegistrations, eventCache);
	    eventGeneratorGenerateEventsForType(eventGenerator, events, "child_moved" /* ChangeType.CHILD_MOVED */, moves, eventRegistrations, eventCache);
	    eventGeneratorGenerateEventsForType(eventGenerator, events, "child_changed" /* ChangeType.CHILD_CHANGED */, changes, eventRegistrations, eventCache);
	    eventGeneratorGenerateEventsForType(eventGenerator, events, "value" /* ChangeType.VALUE */, changes, eventRegistrations, eventCache);
	    return events;
	}
	/**
	 * Given changes of a single change type, generate the corresponding events.
	 */
	function eventGeneratorGenerateEventsForType(eventGenerator, events, eventType, changes, registrations, eventCache) {
	    const filteredChanges = changes.filter(change => change.type === eventType);
	    filteredChanges.sort((a, b) => eventGeneratorCompareChanges(eventGenerator, a, b));
	    filteredChanges.forEach(change => {
	        const materializedChange = eventGeneratorMaterializeSingleChange(eventGenerator, change, eventCache);
	        registrations.forEach(registration => {
	            if (registration.respondsTo(change.type)) {
	                events.push(registration.createEvent(materializedChange, eventGenerator.query_));
	            }
	        });
	    });
	}
	function eventGeneratorMaterializeSingleChange(eventGenerator, change, eventCache) {
	    if (change.type === 'value' || change.type === 'child_removed') {
	        return change;
	    }
	    else {
	        change.prevName = eventCache.getPredecessorChildName(change.childName, change.snapshotNode, eventGenerator.index_);
	        return change;
	    }
	}
	function eventGeneratorCompareChanges(eventGenerator, a, b) {
	    if (a.childName == null || b.childName == null) {
	        throw assertionError('Should only compare child_ events.');
	    }
	    const aWrapped = new NamedNode(a.childName, a.snapshotNode);
	    const bWrapped = new NamedNode(b.childName, b.snapshotNode);
	    return eventGenerator.index_.compare(aWrapped, bWrapped);
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function newViewCache(eventCache, serverCache) {
	    return { eventCache, serverCache };
	}
	function viewCacheUpdateEventSnap(viewCache, eventSnap, complete, filtered) {
	    return newViewCache(new CacheNode(eventSnap, complete, filtered), viewCache.serverCache);
	}
	function viewCacheUpdateServerSnap(viewCache, serverSnap, complete, filtered) {
	    return newViewCache(viewCache.eventCache, new CacheNode(serverSnap, complete, filtered));
	}
	function viewCacheGetCompleteEventSnap(viewCache) {
	    return viewCache.eventCache.isFullyInitialized()
	        ? viewCache.eventCache.getNode()
	        : null;
	}
	function viewCacheGetCompleteServerSnap(viewCache) {
	    return viewCache.serverCache.isFullyInitialized()
	        ? viewCache.serverCache.getNode()
	        : null;
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	let emptyChildrenSingleton;
	/**
	 * Singleton empty children collection.
	 *
	 */
	const EmptyChildren = () => {
	    if (!emptyChildrenSingleton) {
	        emptyChildrenSingleton = new SortedMap(stringCompare);
	    }
	    return emptyChildrenSingleton;
	};
	/**
	 * A tree with immutable elements.
	 */
	class ImmutableTree {
	    constructor(value, children = EmptyChildren()) {
	        this.value = value;
	        this.children = children;
	    }
	    static fromObject(obj) {
	        let tree = new ImmutableTree(null);
	        each(obj, (childPath, childSnap) => {
	            tree = tree.set(new Path(childPath), childSnap);
	        });
	        return tree;
	    }
	    /**
	     * True if the value is empty and there are no children
	     */
	    isEmpty() {
	        return this.value === null && this.children.isEmpty();
	    }
	    /**
	     * Given a path and predicate, return the first node and the path to that node
	     * where the predicate returns true.
	     *
	     * TODO Do a perf test -- If we're creating a bunch of `{path: value:}`
	     * objects on the way back out, it may be better to pass down a pathSoFar obj.
	     *
	     * @param relativePath - The remainder of the path
	     * @param predicate - The predicate to satisfy to return a node
	     */
	    findRootMostMatchingPathAndValue(relativePath, predicate) {
	        if (this.value != null && predicate(this.value)) {
	            return { path: newEmptyPath(), value: this.value };
	        }
	        else {
	            if (pathIsEmpty(relativePath)) {
	                return null;
	            }
	            else {
	                const front = pathGetFront(relativePath);
	                const child = this.children.get(front);
	                if (child !== null) {
	                    const childExistingPathAndValue = child.findRootMostMatchingPathAndValue(pathPopFront(relativePath), predicate);
	                    if (childExistingPathAndValue != null) {
	                        const fullPath = pathChild(new Path(front), childExistingPathAndValue.path);
	                        return { path: fullPath, value: childExistingPathAndValue.value };
	                    }
	                    else {
	                        return null;
	                    }
	                }
	                else {
	                    return null;
	                }
	            }
	        }
	    }
	    /**
	     * Find, if it exists, the shortest subpath of the given path that points a defined
	     * value in the tree
	     */
	    findRootMostValueAndPath(relativePath) {
	        return this.findRootMostMatchingPathAndValue(relativePath, () => true);
	    }
	    /**
	     * @returns The subtree at the given path
	     */
	    subtree(relativePath) {
	        if (pathIsEmpty(relativePath)) {
	            return this;
	        }
	        else {
	            const front = pathGetFront(relativePath);
	            const childTree = this.children.get(front);
	            if (childTree !== null) {
	                return childTree.subtree(pathPopFront(relativePath));
	            }
	            else {
	                return new ImmutableTree(null);
	            }
	        }
	    }
	    /**
	     * Sets a value at the specified path.
	     *
	     * @param relativePath - Path to set value at.
	     * @param toSet - Value to set.
	     * @returns Resulting tree.
	     */
	    set(relativePath, toSet) {
	        if (pathIsEmpty(relativePath)) {
	            return new ImmutableTree(toSet, this.children);
	        }
	        else {
	            const front = pathGetFront(relativePath);
	            const child = this.children.get(front) || new ImmutableTree(null);
	            const newChild = child.set(pathPopFront(relativePath), toSet);
	            const newChildren = this.children.insert(front, newChild);
	            return new ImmutableTree(this.value, newChildren);
	        }
	    }
	    /**
	     * Removes the value at the specified path.
	     *
	     * @param relativePath - Path to value to remove.
	     * @returns Resulting tree.
	     */
	    remove(relativePath) {
	        if (pathIsEmpty(relativePath)) {
	            if (this.children.isEmpty()) {
	                return new ImmutableTree(null);
	            }
	            else {
	                return new ImmutableTree(null, this.children);
	            }
	        }
	        else {
	            const front = pathGetFront(relativePath);
	            const child = this.children.get(front);
	            if (child) {
	                const newChild = child.remove(pathPopFront(relativePath));
	                let newChildren;
	                if (newChild.isEmpty()) {
	                    newChildren = this.children.remove(front);
	                }
	                else {
	                    newChildren = this.children.insert(front, newChild);
	                }
	                if (this.value === null && newChildren.isEmpty()) {
	                    return new ImmutableTree(null);
	                }
	                else {
	                    return new ImmutableTree(this.value, newChildren);
	                }
	            }
	            else {
	                return this;
	            }
	        }
	    }
	    /**
	     * Gets a value from the tree.
	     *
	     * @param relativePath - Path to get value for.
	     * @returns Value at path, or null.
	     */
	    get(relativePath) {
	        if (pathIsEmpty(relativePath)) {
	            return this.value;
	        }
	        else {
	            const front = pathGetFront(relativePath);
	            const child = this.children.get(front);
	            if (child) {
	                return child.get(pathPopFront(relativePath));
	            }
	            else {
	                return null;
	            }
	        }
	    }
	    /**
	     * Replace the subtree at the specified path with the given new tree.
	     *
	     * @param relativePath - Path to replace subtree for.
	     * @param newTree - New tree.
	     * @returns Resulting tree.
	     */
	    setTree(relativePath, newTree) {
	        if (pathIsEmpty(relativePath)) {
	            return newTree;
	        }
	        else {
	            const front = pathGetFront(relativePath);
	            const child = this.children.get(front) || new ImmutableTree(null);
	            const newChild = child.setTree(pathPopFront(relativePath), newTree);
	            let newChildren;
	            if (newChild.isEmpty()) {
	                newChildren = this.children.remove(front);
	            }
	            else {
	                newChildren = this.children.insert(front, newChild);
	            }
	            return new ImmutableTree(this.value, newChildren);
	        }
	    }
	    /**
	     * Performs a depth first fold on this tree. Transforms a tree into a single
	     * value, given a function that operates on the path to a node, an optional
	     * current value, and a map of child names to folded subtrees
	     */
	    fold(fn) {
	        return this.fold_(newEmptyPath(), fn);
	    }
	    /**
	     * Recursive helper for public-facing fold() method
	     */
	    fold_(pathSoFar, fn) {
	        const accum = {};
	        this.children.inorderTraversal((childKey, childTree) => {
	            accum[childKey] = childTree.fold_(pathChild(pathSoFar, childKey), fn);
	        });
	        return fn(pathSoFar, this.value, accum);
	    }
	    /**
	     * Find the first matching value on the given path. Return the result of applying f to it.
	     */
	    findOnPath(path, f) {
	        return this.findOnPath_(path, newEmptyPath(), f);
	    }
	    findOnPath_(pathToFollow, pathSoFar, f) {
	        const result = this.value ? f(pathSoFar, this.value) : false;
	        if (result) {
	            return result;
	        }
	        else {
	            if (pathIsEmpty(pathToFollow)) {
	                return null;
	            }
	            else {
	                const front = pathGetFront(pathToFollow);
	                const nextChild = this.children.get(front);
	                if (nextChild) {
	                    return nextChild.findOnPath_(pathPopFront(pathToFollow), pathChild(pathSoFar, front), f);
	                }
	                else {
	                    return null;
	                }
	            }
	        }
	    }
	    foreachOnPath(path, f) {
	        return this.foreachOnPath_(path, newEmptyPath(), f);
	    }
	    foreachOnPath_(pathToFollow, currentRelativePath, f) {
	        if (pathIsEmpty(pathToFollow)) {
	            return this;
	        }
	        else {
	            if (this.value) {
	                f(currentRelativePath, this.value);
	            }
	            const front = pathGetFront(pathToFollow);
	            const nextChild = this.children.get(front);
	            if (nextChild) {
	                return nextChild.foreachOnPath_(pathPopFront(pathToFollow), pathChild(currentRelativePath, front), f);
	            }
	            else {
	                return new ImmutableTree(null);
	            }
	        }
	    }
	    /**
	     * Calls the given function for each node in the tree that has a value.
	     *
	     * @param f - A function to be called with the path from the root of the tree to
	     * a node, and the value at that node. Called in depth-first order.
	     */
	    foreach(f) {
	        this.foreach_(newEmptyPath(), f);
	    }
	    foreach_(currentRelativePath, f) {
	        this.children.inorderTraversal((childName, childTree) => {
	            childTree.foreach_(pathChild(currentRelativePath, childName), f);
	        });
	        if (this.value) {
	            f(currentRelativePath, this.value);
	        }
	    }
	    foreachChild(f) {
	        this.children.inorderTraversal((childName, childTree) => {
	            if (childTree.value) {
	                f(childName, childTree.value);
	            }
	        });
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * This class holds a collection of writes that can be applied to nodes in unison. It abstracts away the logic with
	 * dealing with priority writes and multiple nested writes. At any given path there is only allowed to be one write
	 * modifying that path. Any write to an existing path or shadowing an existing path will modify that existing write
	 * to reflect the write added.
	 */
	class CompoundWrite {
	    constructor(writeTree_) {
	        this.writeTree_ = writeTree_;
	    }
	    static empty() {
	        return new CompoundWrite(new ImmutableTree(null));
	    }
	}
	function compoundWriteAddWrite(compoundWrite, path, node) {
	    if (pathIsEmpty(path)) {
	        return new CompoundWrite(new ImmutableTree(node));
	    }
	    else {
	        const rootmost = compoundWrite.writeTree_.findRootMostValueAndPath(path);
	        if (rootmost != null) {
	            const rootMostPath = rootmost.path;
	            let value = rootmost.value;
	            const relativePath = newRelativePath(rootMostPath, path);
	            value = value.updateChild(relativePath, node);
	            return new CompoundWrite(compoundWrite.writeTree_.set(rootMostPath, value));
	        }
	        else {
	            const subtree = new ImmutableTree(node);
	            const newWriteTree = compoundWrite.writeTree_.setTree(path, subtree);
	            return new CompoundWrite(newWriteTree);
	        }
	    }
	}
	function compoundWriteAddWrites(compoundWrite, path, updates) {
	    let newWrite = compoundWrite;
	    each(updates, (childKey, node) => {
	        newWrite = compoundWriteAddWrite(newWrite, pathChild(path, childKey), node);
	    });
	    return newWrite;
	}
	/**
	 * Will remove a write at the given path and deeper paths. This will <em>not</em> modify a write at a higher
	 * location, which must be removed by calling this method with that path.
	 *
	 * @param compoundWrite - The CompoundWrite to remove.
	 * @param path - The path at which a write and all deeper writes should be removed
	 * @returns The new CompoundWrite with the removed path
	 */
	function compoundWriteRemoveWrite(compoundWrite, path) {
	    if (pathIsEmpty(path)) {
	        return CompoundWrite.empty();
	    }
	    else {
	        const newWriteTree = compoundWrite.writeTree_.setTree(path, new ImmutableTree(null));
	        return new CompoundWrite(newWriteTree);
	    }
	}
	/**
	 * Returns whether this CompoundWrite will fully overwrite a node at a given location and can therefore be
	 * considered "complete".
	 *
	 * @param compoundWrite - The CompoundWrite to check.
	 * @param path - The path to check for
	 * @returns Whether there is a complete write at that path
	 */
	function compoundWriteHasCompleteWrite(compoundWrite, path) {
	    return compoundWriteGetCompleteNode(compoundWrite, path) != null;
	}
	/**
	 * Returns a node for a path if and only if the node is a "complete" overwrite at that path. This will not aggregate
	 * writes from deeper paths, but will return child nodes from a more shallow path.
	 *
	 * @param compoundWrite - The CompoundWrite to get the node from.
	 * @param path - The path to get a complete write
	 * @returns The node if complete at that path, or null otherwise.
	 */
	function compoundWriteGetCompleteNode(compoundWrite, path) {
	    const rootmost = compoundWrite.writeTree_.findRootMostValueAndPath(path);
	    if (rootmost != null) {
	        return compoundWrite.writeTree_
	            .get(rootmost.path)
	            .getChild(newRelativePath(rootmost.path, path));
	    }
	    else {
	        return null;
	    }
	}
	/**
	 * Returns all children that are guaranteed to be a complete overwrite.
	 *
	 * @param compoundWrite - The CompoundWrite to get children from.
	 * @returns A list of all complete children.
	 */
	function compoundWriteGetCompleteChildren(compoundWrite) {
	    const children = [];
	    const node = compoundWrite.writeTree_.value;
	    if (node != null) {
	        // If it's a leaf node, it has no children; so nothing to do.
	        if (!node.isLeafNode()) {
	            node.forEachChild(PRIORITY_INDEX, (childName, childNode) => {
	                children.push(new NamedNode(childName, childNode));
	            });
	        }
	    }
	    else {
	        compoundWrite.writeTree_.children.inorderTraversal((childName, childTree) => {
	            if (childTree.value != null) {
	                children.push(new NamedNode(childName, childTree.value));
	            }
	        });
	    }
	    return children;
	}
	function compoundWriteChildCompoundWrite(compoundWrite, path) {
	    if (pathIsEmpty(path)) {
	        return compoundWrite;
	    }
	    else {
	        const shadowingNode = compoundWriteGetCompleteNode(compoundWrite, path);
	        if (shadowingNode != null) {
	            return new CompoundWrite(new ImmutableTree(shadowingNode));
	        }
	        else {
	            return new CompoundWrite(compoundWrite.writeTree_.subtree(path));
	        }
	    }
	}
	/**
	 * Returns true if this CompoundWrite is empty and therefore does not modify any nodes.
	 * @returns Whether this CompoundWrite is empty
	 */
	function compoundWriteIsEmpty(compoundWrite) {
	    return compoundWrite.writeTree_.isEmpty();
	}
	/**
	 * Applies this CompoundWrite to a node. The node is returned with all writes from this CompoundWrite applied to the
	 * node
	 * @param node - The node to apply this CompoundWrite to
	 * @returns The node with all writes applied
	 */
	function compoundWriteApply(compoundWrite, node) {
	    return applySubtreeWrite(newEmptyPath(), compoundWrite.writeTree_, node);
	}
	function applySubtreeWrite(relativePath, writeTree, node) {
	    if (writeTree.value != null) {
	        // Since there a write is always a leaf, we're done here
	        return node.updateChild(relativePath, writeTree.value);
	    }
	    else {
	        let priorityWrite = null;
	        writeTree.children.inorderTraversal((childKey, childTree) => {
	            if (childKey === '.priority') {
	                // Apply priorities at the end so we don't update priorities for either empty nodes or forget
	                // to apply priorities to empty nodes that are later filled
	                assert(childTree.value !== null, 'Priority writes must always be leaf nodes');
	                priorityWrite = childTree.value;
	            }
	            else {
	                node = applySubtreeWrite(pathChild(relativePath, childKey), childTree, node);
	            }
	        });
	        // If there was a priority write, we only apply it if the node is not empty
	        if (!node.getChild(relativePath).isEmpty() && priorityWrite !== null) {
	            node = node.updateChild(pathChild(relativePath, '.priority'), priorityWrite);
	        }
	        return node;
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Create a new WriteTreeRef for the given path. For use with a new sync point at the given path.
	 *
	 */
	function writeTreeChildWrites(writeTree, path) {
	    return newWriteTreeRef(path, writeTree);
	}
	/**
	 * Record a new overwrite from user code.
	 *
	 * @param visible - This is set to false by some transactions. It should be excluded from event caches
	 */
	function writeTreeAddOverwrite(writeTree, path, snap, writeId, visible) {
	    assert(writeId > writeTree.lastWriteId, 'Stacking an older write on top of newer ones');
	    if (visible === undefined) {
	        visible = true;
	    }
	    writeTree.allWrites.push({
	        path,
	        snap,
	        writeId,
	        visible
	    });
	    if (visible) {
	        writeTree.visibleWrites = compoundWriteAddWrite(writeTree.visibleWrites, path, snap);
	    }
	    writeTree.lastWriteId = writeId;
	}
	function writeTreeGetWrite(writeTree, writeId) {
	    for (let i = 0; i < writeTree.allWrites.length; i++) {
	        const record = writeTree.allWrites[i];
	        if (record.writeId === writeId) {
	            return record;
	        }
	    }
	    return null;
	}
	/**
	 * Remove a write (either an overwrite or merge) that has been successfully acknowledge by the server. Recalculates
	 * the tree if necessary.  We return true if it may have been visible, meaning views need to reevaluate.
	 *
	 * @returns true if the write may have been visible (meaning we'll need to reevaluate / raise
	 * events as a result).
	 */
	function writeTreeRemoveWrite(writeTree, writeId) {
	    // Note: disabling this check. It could be a transaction that preempted another transaction, and thus was applied
	    // out of order.
	    //const validClear = revert || this.allWrites_.length === 0 || writeId <= this.allWrites_[0].writeId;
	    //assert(validClear, "Either we don't have this write, or it's the first one in the queue");
	    const idx = writeTree.allWrites.findIndex(s => {
	        return s.writeId === writeId;
	    });
	    assert(idx >= 0, 'removeWrite called with nonexistent writeId.');
	    const writeToRemove = writeTree.allWrites[idx];
	    writeTree.allWrites.splice(idx, 1);
	    let removedWriteWasVisible = writeToRemove.visible;
	    let removedWriteOverlapsWithOtherWrites = false;
	    let i = writeTree.allWrites.length - 1;
	    while (removedWriteWasVisible && i >= 0) {
	        const currentWrite = writeTree.allWrites[i];
	        if (currentWrite.visible) {
	            if (i >= idx &&
	                writeTreeRecordContainsPath_(currentWrite, writeToRemove.path)) {
	                // The removed write was completely shadowed by a subsequent write.
	                removedWriteWasVisible = false;
	            }
	            else if (pathContains(writeToRemove.path, currentWrite.path)) {
	                // Either we're covering some writes or they're covering part of us (depending on which came first).
	                removedWriteOverlapsWithOtherWrites = true;
	            }
	        }
	        i--;
	    }
	    if (!removedWriteWasVisible) {
	        return false;
	    }
	    else if (removedWriteOverlapsWithOtherWrites) {
	        // There's some shadowing going on. Just rebuild the visible writes from scratch.
	        writeTreeResetTree_(writeTree);
	        return true;
	    }
	    else {
	        // There's no shadowing.  We can safely just remove the write(s) from visibleWrites.
	        if (writeToRemove.snap) {
	            writeTree.visibleWrites = compoundWriteRemoveWrite(writeTree.visibleWrites, writeToRemove.path);
	        }
	        else {
	            const children = writeToRemove.children;
	            each(children, (childName) => {
	                writeTree.visibleWrites = compoundWriteRemoveWrite(writeTree.visibleWrites, pathChild(writeToRemove.path, childName));
	            });
	        }
	        return true;
	    }
	}
	function writeTreeRecordContainsPath_(writeRecord, path) {
	    if (writeRecord.snap) {
	        return pathContains(writeRecord.path, path);
	    }
	    else {
	        for (const childName in writeRecord.children) {
	            if (writeRecord.children.hasOwnProperty(childName) &&
	                pathContains(pathChild(writeRecord.path, childName), path)) {
	                return true;
	            }
	        }
	        return false;
	    }
	}
	/**
	 * Re-layer the writes and merges into a tree so we can efficiently calculate event snapshots
	 */
	function writeTreeResetTree_(writeTree) {
	    writeTree.visibleWrites = writeTreeLayerTree_(writeTree.allWrites, writeTreeDefaultFilter_, newEmptyPath());
	    if (writeTree.allWrites.length > 0) {
	        writeTree.lastWriteId =
	            writeTree.allWrites[writeTree.allWrites.length - 1].writeId;
	    }
	    else {
	        writeTree.lastWriteId = -1;
	    }
	}
	/**
	 * The default filter used when constructing the tree. Keep everything that's visible.
	 */
	function writeTreeDefaultFilter_(write) {
	    return write.visible;
	}
	/**
	 * Static method. Given an array of WriteRecords, a filter for which ones to include, and a path, construct the tree of
	 * event data at that path.
	 */
	function writeTreeLayerTree_(writes, filter, treeRoot) {
	    let compoundWrite = CompoundWrite.empty();
	    for (let i = 0; i < writes.length; ++i) {
	        const write = writes[i];
	        // Theory, a later set will either:
	        // a) abort a relevant transaction, so no need to worry about excluding it from calculating that transaction
	        // b) not be relevant to a transaction (separate branch), so again will not affect the data for that transaction
	        if (filter(write)) {
	            const writePath = write.path;
	            let relativePath;
	            if (write.snap) {
	                if (pathContains(treeRoot, writePath)) {
	                    relativePath = newRelativePath(treeRoot, writePath);
	                    compoundWrite = compoundWriteAddWrite(compoundWrite, relativePath, write.snap);
	                }
	                else if (pathContains(writePath, treeRoot)) {
	                    relativePath = newRelativePath(writePath, treeRoot);
	                    compoundWrite = compoundWriteAddWrite(compoundWrite, newEmptyPath(), write.snap.getChild(relativePath));
	                }
	                else ;
	            }
	            else if (write.children) {
	                if (pathContains(treeRoot, writePath)) {
	                    relativePath = newRelativePath(treeRoot, writePath);
	                    compoundWrite = compoundWriteAddWrites(compoundWrite, relativePath, write.children);
	                }
	                else if (pathContains(writePath, treeRoot)) {
	                    relativePath = newRelativePath(writePath, treeRoot);
	                    if (pathIsEmpty(relativePath)) {
	                        compoundWrite = compoundWriteAddWrites(compoundWrite, newEmptyPath(), write.children);
	                    }
	                    else {
	                        const child = safeGet(write.children, pathGetFront(relativePath));
	                        if (child) {
	                            // There exists a child in this node that matches the root path
	                            const deepNode = child.getChild(pathPopFront(relativePath));
	                            compoundWrite = compoundWriteAddWrite(compoundWrite, newEmptyPath(), deepNode);
	                        }
	                    }
	                }
	                else ;
	            }
	            else {
	                throw assertionError('WriteRecord should have .snap or .children');
	            }
	        }
	    }
	    return compoundWrite;
	}
	/**
	 * Given optional, underlying server data, and an optional set of constraints (exclude some sets, include hidden
	 * writes), attempt to calculate a complete snapshot for the given path
	 *
	 * @param writeIdsToExclude - An optional set to be excluded
	 * @param includeHiddenWrites - Defaults to false, whether or not to layer on writes with visible set to false
	 */
	function writeTreeCalcCompleteEventCache(writeTree, treePath, completeServerCache, writeIdsToExclude, includeHiddenWrites) {
	    if (!writeIdsToExclude && !includeHiddenWrites) {
	        const shadowingNode = compoundWriteGetCompleteNode(writeTree.visibleWrites, treePath);
	        if (shadowingNode != null) {
	            return shadowingNode;
	        }
	        else {
	            const subMerge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
	            if (compoundWriteIsEmpty(subMerge)) {
	                return completeServerCache;
	            }
	            else if (completeServerCache == null &&
	                !compoundWriteHasCompleteWrite(subMerge, newEmptyPath())) {
	                // We wouldn't have a complete snapshot, since there's no underlying data and no complete shadow
	                return null;
	            }
	            else {
	                const layeredCache = completeServerCache || ChildrenNode.EMPTY_NODE;
	                return compoundWriteApply(subMerge, layeredCache);
	            }
	        }
	    }
	    else {
	        const merge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
	        if (!includeHiddenWrites && compoundWriteIsEmpty(merge)) {
	            return completeServerCache;
	        }
	        else {
	            // If the server cache is null, and we don't have a complete cache, we need to return null
	            if (!includeHiddenWrites &&
	                completeServerCache == null &&
	                !compoundWriteHasCompleteWrite(merge, newEmptyPath())) {
	                return null;
	            }
	            else {
	                const filter = function (write) {
	                    return ((write.visible || includeHiddenWrites) &&
	                        (!writeIdsToExclude ||
	                            !~writeIdsToExclude.indexOf(write.writeId)) &&
	                        (pathContains(write.path, treePath) ||
	                            pathContains(treePath, write.path)));
	                };
	                const mergeAtPath = writeTreeLayerTree_(writeTree.allWrites, filter, treePath);
	                const layeredCache = completeServerCache || ChildrenNode.EMPTY_NODE;
	                return compoundWriteApply(mergeAtPath, layeredCache);
	            }
	        }
	    }
	}
	/**
	 * With optional, underlying server data, attempt to return a children node of children that we have complete data for.
	 * Used when creating new views, to pre-fill their complete event children snapshot.
	 */
	function writeTreeCalcCompleteEventChildren(writeTree, treePath, completeServerChildren) {
	    let completeChildren = ChildrenNode.EMPTY_NODE;
	    const topLevelSet = compoundWriteGetCompleteNode(writeTree.visibleWrites, treePath);
	    if (topLevelSet) {
	        if (!topLevelSet.isLeafNode()) {
	            // we're shadowing everything. Return the children.
	            topLevelSet.forEachChild(PRIORITY_INDEX, (childName, childSnap) => {
	                completeChildren = completeChildren.updateImmediateChild(childName, childSnap);
	            });
	        }
	        return completeChildren;
	    }
	    else if (completeServerChildren) {
	        // Layer any children we have on top of this
	        // We know we don't have a top-level set, so just enumerate existing children
	        const merge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
	        completeServerChildren.forEachChild(PRIORITY_INDEX, (childName, childNode) => {
	            const node = compoundWriteApply(compoundWriteChildCompoundWrite(merge, new Path(childName)), childNode);
	            completeChildren = completeChildren.updateImmediateChild(childName, node);
	        });
	        // Add any complete children we have from the set
	        compoundWriteGetCompleteChildren(merge).forEach(namedNode => {
	            completeChildren = completeChildren.updateImmediateChild(namedNode.name, namedNode.node);
	        });
	        return completeChildren;
	    }
	    else {
	        // We don't have anything to layer on top of. Layer on any children we have
	        // Note that we can return an empty snap if we have a defined delete
	        const merge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
	        compoundWriteGetCompleteChildren(merge).forEach(namedNode => {
	            completeChildren = completeChildren.updateImmediateChild(namedNode.name, namedNode.node);
	        });
	        return completeChildren;
	    }
	}
	/**
	 * Given that the underlying server data has updated, determine what, if anything, needs to be
	 * applied to the event cache.
	 *
	 * Possibilities:
	 *
	 * 1. No writes are shadowing. Events should be raised, the snap to be applied comes from the server data
	 *
	 * 2. Some write is completely shadowing. No events to be raised
	 *
	 * 3. Is partially shadowed. Events
	 *
	 * Either existingEventSnap or existingServerSnap must exist
	 */
	function writeTreeCalcEventCacheAfterServerOverwrite(writeTree, treePath, childPath, existingEventSnap, existingServerSnap) {
	    assert(existingEventSnap || existingServerSnap, 'Either existingEventSnap or existingServerSnap must exist');
	    const path = pathChild(treePath, childPath);
	    if (compoundWriteHasCompleteWrite(writeTree.visibleWrites, path)) {
	        // At this point we can probably guarantee that we're in case 2, meaning no events
	        // May need to check visibility while doing the findRootMostValueAndPath call
	        return null;
	    }
	    else {
	        // No complete shadowing. We're either partially shadowing or not shadowing at all.
	        const childMerge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, path);
	        if (compoundWriteIsEmpty(childMerge)) {
	            // We're not shadowing at all. Case 1
	            return existingServerSnap.getChild(childPath);
	        }
	        else {
	            // This could be more efficient if the serverNode + updates doesn't change the eventSnap
	            // However this is tricky to find out, since user updates don't necessary change the server
	            // snap, e.g. priority updates on empty nodes, or deep deletes. Another special case is if the server
	            // adds nodes, but doesn't change any existing writes. It is therefore not enough to
	            // only check if the updates change the serverNode.
	            // Maybe check if the merge tree contains these special cases and only do a full overwrite in that case?
	            return compoundWriteApply(childMerge, existingServerSnap.getChild(childPath));
	        }
	    }
	}
	/**
	 * Returns a complete child for a given server snap after applying all user writes or null if there is no
	 * complete child for this ChildKey.
	 */
	function writeTreeCalcCompleteChild(writeTree, treePath, childKey, existingServerSnap) {
	    const path = pathChild(treePath, childKey);
	    const shadowingNode = compoundWriteGetCompleteNode(writeTree.visibleWrites, path);
	    if (shadowingNode != null) {
	        return shadowingNode;
	    }
	    else {
	        if (existingServerSnap.isCompleteForChild(childKey)) {
	            const childMerge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, path);
	            return compoundWriteApply(childMerge, existingServerSnap.getNode().getImmediateChild(childKey));
	        }
	        else {
	            return null;
	        }
	    }
	}
	/**
	 * Returns a node if there is a complete overwrite for this path. More specifically, if there is a write at
	 * a higher path, this will return the child of that write relative to the write and this path.
	 * Returns null if there is no write at this path.
	 */
	function writeTreeShadowingWrite(writeTree, path) {
	    return compoundWriteGetCompleteNode(writeTree.visibleWrites, path);
	}
	/**
	 * This method is used when processing child remove events on a query. If we can, we pull in children that were outside
	 * the window, but may now be in the window.
	 */
	function writeTreeCalcIndexedSlice(writeTree, treePath, completeServerData, startPost, count, reverse, index) {
	    let toIterate;
	    const merge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
	    const shadowingNode = compoundWriteGetCompleteNode(merge, newEmptyPath());
	    if (shadowingNode != null) {
	        toIterate = shadowingNode;
	    }
	    else if (completeServerData != null) {
	        toIterate = compoundWriteApply(merge, completeServerData);
	    }
	    else {
	        // no children to iterate on
	        return [];
	    }
	    toIterate = toIterate.withIndex(index);
	    if (!toIterate.isEmpty() && !toIterate.isLeafNode()) {
	        const nodes = [];
	        const cmp = index.getCompare();
	        const iter = reverse
	            ? toIterate.getReverseIteratorFrom(startPost, index)
	            : toIterate.getIteratorFrom(startPost, index);
	        let next = iter.getNext();
	        while (next && nodes.length < count) {
	            if (cmp(next, startPost) !== 0) {
	                nodes.push(next);
	            }
	            next = iter.getNext();
	        }
	        return nodes;
	    }
	    else {
	        return [];
	    }
	}
	function newWriteTree() {
	    return {
	        visibleWrites: CompoundWrite.empty(),
	        allWrites: [],
	        lastWriteId: -1
	    };
	}
	/**
	 * If possible, returns a complete event cache, using the underlying server data if possible. In addition, can be used
	 * to get a cache that includes hidden writes, and excludes arbitrary writes. Note that customizing the returned node
	 * can lead to a more expensive calculation.
	 *
	 * @param writeIdsToExclude - Optional writes to exclude.
	 * @param includeHiddenWrites - Defaults to false, whether or not to layer on writes with visible set to false
	 */
	function writeTreeRefCalcCompleteEventCache(writeTreeRef, completeServerCache, writeIdsToExclude, includeHiddenWrites) {
	    return writeTreeCalcCompleteEventCache(writeTreeRef.writeTree, writeTreeRef.treePath, completeServerCache, writeIdsToExclude, includeHiddenWrites);
	}
	/**
	 * If possible, returns a children node containing all of the complete children we have data for. The returned data is a
	 * mix of the given server data and write data.
	 *
	 */
	function writeTreeRefCalcCompleteEventChildren(writeTreeRef, completeServerChildren) {
	    return writeTreeCalcCompleteEventChildren(writeTreeRef.writeTree, writeTreeRef.treePath, completeServerChildren);
	}
	/**
	 * Given that either the underlying server data has updated or the outstanding writes have updated, determine what,
	 * if anything, needs to be applied to the event cache.
	 *
	 * Possibilities:
	 *
	 * 1. No writes are shadowing. Events should be raised, the snap to be applied comes from the server data
	 *
	 * 2. Some write is completely shadowing. No events to be raised
	 *
	 * 3. Is partially shadowed. Events should be raised
	 *
	 * Either existingEventSnap or existingServerSnap must exist, this is validated via an assert
	 *
	 *
	 */
	function writeTreeRefCalcEventCacheAfterServerOverwrite(writeTreeRef, path, existingEventSnap, existingServerSnap) {
	    return writeTreeCalcEventCacheAfterServerOverwrite(writeTreeRef.writeTree, writeTreeRef.treePath, path, existingEventSnap, existingServerSnap);
	}
	/**
	 * Returns a node if there is a complete overwrite for this path. More specifically, if there is a write at
	 * a higher path, this will return the child of that write relative to the write and this path.
	 * Returns null if there is no write at this path.
	 *
	 */
	function writeTreeRefShadowingWrite(writeTreeRef, path) {
	    return writeTreeShadowingWrite(writeTreeRef.writeTree, pathChild(writeTreeRef.treePath, path));
	}
	/**
	 * This method is used when processing child remove events on a query. If we can, we pull in children that were outside
	 * the window, but may now be in the window
	 */
	function writeTreeRefCalcIndexedSlice(writeTreeRef, completeServerData, startPost, count, reverse, index) {
	    return writeTreeCalcIndexedSlice(writeTreeRef.writeTree, writeTreeRef.treePath, completeServerData, startPost, count, reverse, index);
	}
	/**
	 * Returns a complete child for a given server snap after applying all user writes or null if there is no
	 * complete child for this ChildKey.
	 */
	function writeTreeRefCalcCompleteChild(writeTreeRef, childKey, existingServerCache) {
	    return writeTreeCalcCompleteChild(writeTreeRef.writeTree, writeTreeRef.treePath, childKey, existingServerCache);
	}
	/**
	 * Return a WriteTreeRef for a child.
	 */
	function writeTreeRefChild(writeTreeRef, childName) {
	    return newWriteTreeRef(pathChild(writeTreeRef.treePath, childName), writeTreeRef.writeTree);
	}
	function newWriteTreeRef(path, writeTree) {
	    return {
	        treePath: path,
	        writeTree
	    };
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class ChildChangeAccumulator {
	    constructor() {
	        this.changeMap = new Map();
	    }
	    trackChildChange(change) {
	        const type = change.type;
	        const childKey = change.childName;
	        assert(type === "child_added" /* ChangeType.CHILD_ADDED */ ||
	            type === "child_changed" /* ChangeType.CHILD_CHANGED */ ||
	            type === "child_removed" /* ChangeType.CHILD_REMOVED */, 'Only child changes supported for tracking');
	        assert(childKey !== '.priority', 'Only non-priority child changes can be tracked.');
	        const oldChange = this.changeMap.get(childKey);
	        if (oldChange) {
	            const oldType = oldChange.type;
	            if (type === "child_added" /* ChangeType.CHILD_ADDED */ &&
	                oldType === "child_removed" /* ChangeType.CHILD_REMOVED */) {
	                this.changeMap.set(childKey, changeChildChanged(childKey, change.snapshotNode, oldChange.snapshotNode));
	            }
	            else if (type === "child_removed" /* ChangeType.CHILD_REMOVED */ &&
	                oldType === "child_added" /* ChangeType.CHILD_ADDED */) {
	                this.changeMap.delete(childKey);
	            }
	            else if (type === "child_removed" /* ChangeType.CHILD_REMOVED */ &&
	                oldType === "child_changed" /* ChangeType.CHILD_CHANGED */) {
	                this.changeMap.set(childKey, changeChildRemoved(childKey, oldChange.oldSnap));
	            }
	            else if (type === "child_changed" /* ChangeType.CHILD_CHANGED */ &&
	                oldType === "child_added" /* ChangeType.CHILD_ADDED */) {
	                this.changeMap.set(childKey, changeChildAdded(childKey, change.snapshotNode));
	            }
	            else if (type === "child_changed" /* ChangeType.CHILD_CHANGED */ &&
	                oldType === "child_changed" /* ChangeType.CHILD_CHANGED */) {
	                this.changeMap.set(childKey, changeChildChanged(childKey, change.snapshotNode, oldChange.oldSnap));
	            }
	            else {
	                throw assertionError('Illegal combination of changes: ' +
	                    change +
	                    ' occurred after ' +
	                    oldChange);
	            }
	        }
	        else {
	            this.changeMap.set(childKey, change);
	        }
	    }
	    getChanges() {
	        return Array.from(this.changeMap.values());
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * An implementation of CompleteChildSource that never returns any additional children
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	class NoCompleteChildSource_ {
	    getCompleteChild(childKey) {
	        return null;
	    }
	    getChildAfterChild(index, child, reverse) {
	        return null;
	    }
	}
	/**
	 * Singleton instance.
	 */
	const NO_COMPLETE_CHILD_SOURCE = new NoCompleteChildSource_();
	/**
	 * An implementation of CompleteChildSource that uses a WriteTree in addition to any other server data or
	 * old event caches available to calculate complete children.
	 */
	class WriteTreeCompleteChildSource {
	    constructor(writes_, viewCache_, optCompleteServerCache_ = null) {
	        this.writes_ = writes_;
	        this.viewCache_ = viewCache_;
	        this.optCompleteServerCache_ = optCompleteServerCache_;
	    }
	    getCompleteChild(childKey) {
	        const node = this.viewCache_.eventCache;
	        if (node.isCompleteForChild(childKey)) {
	            return node.getNode().getImmediateChild(childKey);
	        }
	        else {
	            const serverNode = this.optCompleteServerCache_ != null
	                ? new CacheNode(this.optCompleteServerCache_, true, false)
	                : this.viewCache_.serverCache;
	            return writeTreeRefCalcCompleteChild(this.writes_, childKey, serverNode);
	        }
	    }
	    getChildAfterChild(index, child, reverse) {
	        const completeServerData = this.optCompleteServerCache_ != null
	            ? this.optCompleteServerCache_
	            : viewCacheGetCompleteServerSnap(this.viewCache_);
	        const nodes = writeTreeRefCalcIndexedSlice(this.writes_, completeServerData, child, 1, reverse, index);
	        if (nodes.length === 0) {
	            return null;
	        }
	        else {
	            return nodes[0];
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function newViewProcessor(filter) {
	    return { filter };
	}
	function viewProcessorAssertIndexed(viewProcessor, viewCache) {
	    assert(viewCache.eventCache.getNode().isIndexed(viewProcessor.filter.getIndex()), 'Event snap not indexed');
	    assert(viewCache.serverCache.getNode().isIndexed(viewProcessor.filter.getIndex()), 'Server snap not indexed');
	}
	function viewProcessorApplyOperation(viewProcessor, oldViewCache, operation, writesCache, completeCache) {
	    const accumulator = new ChildChangeAccumulator();
	    let newViewCache, filterServerNode;
	    if (operation.type === OperationType.OVERWRITE) {
	        const overwrite = operation;
	        if (overwrite.source.fromUser) {
	            newViewCache = viewProcessorApplyUserOverwrite(viewProcessor, oldViewCache, overwrite.path, overwrite.snap, writesCache, completeCache, accumulator);
	        }
	        else {
	            assert(overwrite.source.fromServer, 'Unknown source.');
	            // We filter the node if it's a tagged update or the node has been previously filtered  and the
	            // update is not at the root in which case it is ok (and necessary) to mark the node unfiltered
	            // again
	            filterServerNode =
	                overwrite.source.tagged ||
	                    (oldViewCache.serverCache.isFiltered() && !pathIsEmpty(overwrite.path));
	            newViewCache = viewProcessorApplyServerOverwrite(viewProcessor, oldViewCache, overwrite.path, overwrite.snap, writesCache, completeCache, filterServerNode, accumulator);
	        }
	    }
	    else if (operation.type === OperationType.MERGE) {
	        const merge = operation;
	        if (merge.source.fromUser) {
	            newViewCache = viewProcessorApplyUserMerge(viewProcessor, oldViewCache, merge.path, merge.children, writesCache, completeCache, accumulator);
	        }
	        else {
	            assert(merge.source.fromServer, 'Unknown source.');
	            // We filter the node if it's a tagged update or the node has been previously filtered
	            filterServerNode =
	                merge.source.tagged || oldViewCache.serverCache.isFiltered();
	            newViewCache = viewProcessorApplyServerMerge(viewProcessor, oldViewCache, merge.path, merge.children, writesCache, completeCache, filterServerNode, accumulator);
	        }
	    }
	    else if (operation.type === OperationType.ACK_USER_WRITE) {
	        const ackUserWrite = operation;
	        if (!ackUserWrite.revert) {
	            newViewCache = viewProcessorAckUserWrite(viewProcessor, oldViewCache, ackUserWrite.path, ackUserWrite.affectedTree, writesCache, completeCache, accumulator);
	        }
	        else {
	            newViewCache = viewProcessorRevertUserWrite(viewProcessor, oldViewCache, ackUserWrite.path, writesCache, completeCache, accumulator);
	        }
	    }
	    else if (operation.type === OperationType.LISTEN_COMPLETE) {
	        newViewCache = viewProcessorListenComplete(viewProcessor, oldViewCache, operation.path, writesCache, accumulator);
	    }
	    else {
	        throw assertionError('Unknown operation type: ' + operation.type);
	    }
	    const changes = accumulator.getChanges();
	    viewProcessorMaybeAddValueEvent(oldViewCache, newViewCache, changes);
	    return { viewCache: newViewCache, changes };
	}
	function viewProcessorMaybeAddValueEvent(oldViewCache, newViewCache, accumulator) {
	    const eventSnap = newViewCache.eventCache;
	    if (eventSnap.isFullyInitialized()) {
	        const isLeafOrEmpty = eventSnap.getNode().isLeafNode() || eventSnap.getNode().isEmpty();
	        const oldCompleteSnap = viewCacheGetCompleteEventSnap(oldViewCache);
	        if (accumulator.length > 0 ||
	            !oldViewCache.eventCache.isFullyInitialized() ||
	            (isLeafOrEmpty && !eventSnap.getNode().equals(oldCompleteSnap)) ||
	            !eventSnap.getNode().getPriority().equals(oldCompleteSnap.getPriority())) {
	            accumulator.push(changeValue(viewCacheGetCompleteEventSnap(newViewCache)));
	        }
	    }
	}
	function viewProcessorGenerateEventCacheAfterServerEvent(viewProcessor, viewCache, changePath, writesCache, source, accumulator) {
	    const oldEventSnap = viewCache.eventCache;
	    if (writeTreeRefShadowingWrite(writesCache, changePath) != null) {
	        // we have a shadowing write, ignore changes
	        return viewCache;
	    }
	    else {
	        let newEventCache, serverNode;
	        if (pathIsEmpty(changePath)) {
	            // TODO: figure out how this plays with "sliding ack windows"
	            assert(viewCache.serverCache.isFullyInitialized(), 'If change path is empty, we must have complete server data');
	            if (viewCache.serverCache.isFiltered()) {
	                // We need to special case this, because we need to only apply writes to complete children, or
	                // we might end up raising events for incomplete children. If the server data is filtered deep
	                // writes cannot be guaranteed to be complete
	                const serverCache = viewCacheGetCompleteServerSnap(viewCache);
	                const completeChildren = serverCache instanceof ChildrenNode
	                    ? serverCache
	                    : ChildrenNode.EMPTY_NODE;
	                const completeEventChildren = writeTreeRefCalcCompleteEventChildren(writesCache, completeChildren);
	                newEventCache = viewProcessor.filter.updateFullNode(viewCache.eventCache.getNode(), completeEventChildren, accumulator);
	            }
	            else {
	                const completeNode = writeTreeRefCalcCompleteEventCache(writesCache, viewCacheGetCompleteServerSnap(viewCache));
	                newEventCache = viewProcessor.filter.updateFullNode(viewCache.eventCache.getNode(), completeNode, accumulator);
	            }
	        }
	        else {
	            const childKey = pathGetFront(changePath);
	            if (childKey === '.priority') {
	                assert(pathGetLength(changePath) === 1, "Can't have a priority with additional path components");
	                const oldEventNode = oldEventSnap.getNode();
	                serverNode = viewCache.serverCache.getNode();
	                // we might have overwrites for this priority
	                const updatedPriority = writeTreeRefCalcEventCacheAfterServerOverwrite(writesCache, changePath, oldEventNode, serverNode);
	                if (updatedPriority != null) {
	                    newEventCache = viewProcessor.filter.updatePriority(oldEventNode, updatedPriority);
	                }
	                else {
	                    // priority didn't change, keep old node
	                    newEventCache = oldEventSnap.getNode();
	                }
	            }
	            else {
	                const childChangePath = pathPopFront(changePath);
	                // update child
	                let newEventChild;
	                if (oldEventSnap.isCompleteForChild(childKey)) {
	                    serverNode = viewCache.serverCache.getNode();
	                    const eventChildUpdate = writeTreeRefCalcEventCacheAfterServerOverwrite(writesCache, changePath, oldEventSnap.getNode(), serverNode);
	                    if (eventChildUpdate != null) {
	                        newEventChild = oldEventSnap
	                            .getNode()
	                            .getImmediateChild(childKey)
	                            .updateChild(childChangePath, eventChildUpdate);
	                    }
	                    else {
	                        // Nothing changed, just keep the old child
	                        newEventChild = oldEventSnap.getNode().getImmediateChild(childKey);
	                    }
	                }
	                else {
	                    newEventChild = writeTreeRefCalcCompleteChild(writesCache, childKey, viewCache.serverCache);
	                }
	                if (newEventChild != null) {
	                    newEventCache = viewProcessor.filter.updateChild(oldEventSnap.getNode(), childKey, newEventChild, childChangePath, source, accumulator);
	                }
	                else {
	                    // no complete child available or no change
	                    newEventCache = oldEventSnap.getNode();
	                }
	            }
	        }
	        return viewCacheUpdateEventSnap(viewCache, newEventCache, oldEventSnap.isFullyInitialized() || pathIsEmpty(changePath), viewProcessor.filter.filtersNodes());
	    }
	}
	function viewProcessorApplyServerOverwrite(viewProcessor, oldViewCache, changePath, changedSnap, writesCache, completeCache, filterServerNode, accumulator) {
	    const oldServerSnap = oldViewCache.serverCache;
	    let newServerCache;
	    const serverFilter = filterServerNode
	        ? viewProcessor.filter
	        : viewProcessor.filter.getIndexedFilter();
	    if (pathIsEmpty(changePath)) {
	        newServerCache = serverFilter.updateFullNode(oldServerSnap.getNode(), changedSnap, null);
	    }
	    else if (serverFilter.filtersNodes() && !oldServerSnap.isFiltered()) {
	        // we want to filter the server node, but we didn't filter the server node yet, so simulate a full update
	        const newServerNode = oldServerSnap
	            .getNode()
	            .updateChild(changePath, changedSnap);
	        newServerCache = serverFilter.updateFullNode(oldServerSnap.getNode(), newServerNode, null);
	    }
	    else {
	        const childKey = pathGetFront(changePath);
	        if (!oldServerSnap.isCompleteForPath(changePath) &&
	            pathGetLength(changePath) > 1) {
	            // We don't update incomplete nodes with updates intended for other listeners
	            return oldViewCache;
	        }
	        const childChangePath = pathPopFront(changePath);
	        const childNode = oldServerSnap.getNode().getImmediateChild(childKey);
	        const newChildNode = childNode.updateChild(childChangePath, changedSnap);
	        if (childKey === '.priority') {
	            newServerCache = serverFilter.updatePriority(oldServerSnap.getNode(), newChildNode);
	        }
	        else {
	            newServerCache = serverFilter.updateChild(oldServerSnap.getNode(), childKey, newChildNode, childChangePath, NO_COMPLETE_CHILD_SOURCE, null);
	        }
	    }
	    const newViewCache = viewCacheUpdateServerSnap(oldViewCache, newServerCache, oldServerSnap.isFullyInitialized() || pathIsEmpty(changePath), serverFilter.filtersNodes());
	    const source = new WriteTreeCompleteChildSource(writesCache, newViewCache, completeCache);
	    return viewProcessorGenerateEventCacheAfterServerEvent(viewProcessor, newViewCache, changePath, writesCache, source, accumulator);
	}
	function viewProcessorApplyUserOverwrite(viewProcessor, oldViewCache, changePath, changedSnap, writesCache, completeCache, accumulator) {
	    const oldEventSnap = oldViewCache.eventCache;
	    let newViewCache, newEventCache;
	    const source = new WriteTreeCompleteChildSource(writesCache, oldViewCache, completeCache);
	    if (pathIsEmpty(changePath)) {
	        newEventCache = viewProcessor.filter.updateFullNode(oldViewCache.eventCache.getNode(), changedSnap, accumulator);
	        newViewCache = viewCacheUpdateEventSnap(oldViewCache, newEventCache, true, viewProcessor.filter.filtersNodes());
	    }
	    else {
	        const childKey = pathGetFront(changePath);
	        if (childKey === '.priority') {
	            newEventCache = viewProcessor.filter.updatePriority(oldViewCache.eventCache.getNode(), changedSnap);
	            newViewCache = viewCacheUpdateEventSnap(oldViewCache, newEventCache, oldEventSnap.isFullyInitialized(), oldEventSnap.isFiltered());
	        }
	        else {
	            const childChangePath = pathPopFront(changePath);
	            const oldChild = oldEventSnap.getNode().getImmediateChild(childKey);
	            let newChild;
	            if (pathIsEmpty(childChangePath)) {
	                // Child overwrite, we can replace the child
	                newChild = changedSnap;
	            }
	            else {
	                const childNode = source.getCompleteChild(childKey);
	                if (childNode != null) {
	                    if (pathGetBack(childChangePath) === '.priority' &&
	                        childNode.getChild(pathParent(childChangePath)).isEmpty()) {
	                        // This is a priority update on an empty node. If this node exists on the server, the
	                        // server will send down the priority in the update, so ignore for now
	                        newChild = childNode;
	                    }
	                    else {
	                        newChild = childNode.updateChild(childChangePath, changedSnap);
	                    }
	                }
	                else {
	                    // There is no complete child node available
	                    newChild = ChildrenNode.EMPTY_NODE;
	                }
	            }
	            if (!oldChild.equals(newChild)) {
	                const newEventSnap = viewProcessor.filter.updateChild(oldEventSnap.getNode(), childKey, newChild, childChangePath, source, accumulator);
	                newViewCache = viewCacheUpdateEventSnap(oldViewCache, newEventSnap, oldEventSnap.isFullyInitialized(), viewProcessor.filter.filtersNodes());
	            }
	            else {
	                newViewCache = oldViewCache;
	            }
	        }
	    }
	    return newViewCache;
	}
	function viewProcessorCacheHasChild(viewCache, childKey) {
	    return viewCache.eventCache.isCompleteForChild(childKey);
	}
	function viewProcessorApplyUserMerge(viewProcessor, viewCache, path, changedChildren, writesCache, serverCache, accumulator) {
	    // HACK: In the case of a limit query, there may be some changes that bump things out of the
	    // window leaving room for new items.  It's important we process these changes first, so we
	    // iterate the changes twice, first processing any that affect items currently in view.
	    // TODO: I consider an item "in view" if cacheHasChild is true, which checks both the server
	    // and event snap.  I'm not sure if this will result in edge cases when a child is in one but
	    // not the other.
	    let curViewCache = viewCache;
	    changedChildren.foreach((relativePath, childNode) => {
	        const writePath = pathChild(path, relativePath);
	        if (viewProcessorCacheHasChild(viewCache, pathGetFront(writePath))) {
	            curViewCache = viewProcessorApplyUserOverwrite(viewProcessor, curViewCache, writePath, childNode, writesCache, serverCache, accumulator);
	        }
	    });
	    changedChildren.foreach((relativePath, childNode) => {
	        const writePath = pathChild(path, relativePath);
	        if (!viewProcessorCacheHasChild(viewCache, pathGetFront(writePath))) {
	            curViewCache = viewProcessorApplyUserOverwrite(viewProcessor, curViewCache, writePath, childNode, writesCache, serverCache, accumulator);
	        }
	    });
	    return curViewCache;
	}
	function viewProcessorApplyMerge(viewProcessor, node, merge) {
	    merge.foreach((relativePath, childNode) => {
	        node = node.updateChild(relativePath, childNode);
	    });
	    return node;
	}
	function viewProcessorApplyServerMerge(viewProcessor, viewCache, path, changedChildren, writesCache, serverCache, filterServerNode, accumulator) {
	    // If we don't have a cache yet, this merge was intended for a previously listen in the same location. Ignore it and
	    // wait for the complete data update coming soon.
	    if (viewCache.serverCache.getNode().isEmpty() &&
	        !viewCache.serverCache.isFullyInitialized()) {
	        return viewCache;
	    }
	    // HACK: In the case of a limit query, there may be some changes that bump things out of the
	    // window leaving room for new items.  It's important we process these changes first, so we
	    // iterate the changes twice, first processing any that affect items currently in view.
	    // TODO: I consider an item "in view" if cacheHasChild is true, which checks both the server
	    // and event snap.  I'm not sure if this will result in edge cases when a child is in one but
	    // not the other.
	    let curViewCache = viewCache;
	    let viewMergeTree;
	    if (pathIsEmpty(path)) {
	        viewMergeTree = changedChildren;
	    }
	    else {
	        viewMergeTree = new ImmutableTree(null).setTree(path, changedChildren);
	    }
	    const serverNode = viewCache.serverCache.getNode();
	    viewMergeTree.children.inorderTraversal((childKey, childTree) => {
	        if (serverNode.hasChild(childKey)) {
	            const serverChild = viewCache.serverCache
	                .getNode()
	                .getImmediateChild(childKey);
	            const newChild = viewProcessorApplyMerge(viewProcessor, serverChild, childTree);
	            curViewCache = viewProcessorApplyServerOverwrite(viewProcessor, curViewCache, new Path(childKey), newChild, writesCache, serverCache, filterServerNode, accumulator);
	        }
	    });
	    viewMergeTree.children.inorderTraversal((childKey, childMergeTree) => {
	        const isUnknownDeepMerge = !viewCache.serverCache.isCompleteForChild(childKey) &&
	            childMergeTree.value === null;
	        if (!serverNode.hasChild(childKey) && !isUnknownDeepMerge) {
	            const serverChild = viewCache.serverCache
	                .getNode()
	                .getImmediateChild(childKey);
	            const newChild = viewProcessorApplyMerge(viewProcessor, serverChild, childMergeTree);
	            curViewCache = viewProcessorApplyServerOverwrite(viewProcessor, curViewCache, new Path(childKey), newChild, writesCache, serverCache, filterServerNode, accumulator);
	        }
	    });
	    return curViewCache;
	}
	function viewProcessorAckUserWrite(viewProcessor, viewCache, ackPath, affectedTree, writesCache, completeCache, accumulator) {
	    if (writeTreeRefShadowingWrite(writesCache, ackPath) != null) {
	        return viewCache;
	    }
	    // Only filter server node if it is currently filtered
	    const filterServerNode = viewCache.serverCache.isFiltered();
	    // Essentially we'll just get our existing server cache for the affected paths and re-apply it as a server update
	    // now that it won't be shadowed.
	    const serverCache = viewCache.serverCache;
	    if (affectedTree.value != null) {
	        // This is an overwrite.
	        if ((pathIsEmpty(ackPath) && serverCache.isFullyInitialized()) ||
	            serverCache.isCompleteForPath(ackPath)) {
	            return viewProcessorApplyServerOverwrite(viewProcessor, viewCache, ackPath, serverCache.getNode().getChild(ackPath), writesCache, completeCache, filterServerNode, accumulator);
	        }
	        else if (pathIsEmpty(ackPath)) {
	            // This is a goofy edge case where we are acking data at this location but don't have full data.  We
	            // should just re-apply whatever we have in our cache as a merge.
	            let changedChildren = new ImmutableTree(null);
	            serverCache.getNode().forEachChild(KEY_INDEX, (name, node) => {
	                changedChildren = changedChildren.set(new Path(name), node);
	            });
	            return viewProcessorApplyServerMerge(viewProcessor, viewCache, ackPath, changedChildren, writesCache, completeCache, filterServerNode, accumulator);
	        }
	        else {
	            return viewCache;
	        }
	    }
	    else {
	        // This is a merge.
	        let changedChildren = new ImmutableTree(null);
	        affectedTree.foreach((mergePath, value) => {
	            const serverCachePath = pathChild(ackPath, mergePath);
	            if (serverCache.isCompleteForPath(serverCachePath)) {
	                changedChildren = changedChildren.set(mergePath, serverCache.getNode().getChild(serverCachePath));
	            }
	        });
	        return viewProcessorApplyServerMerge(viewProcessor, viewCache, ackPath, changedChildren, writesCache, completeCache, filterServerNode, accumulator);
	    }
	}
	function viewProcessorListenComplete(viewProcessor, viewCache, path, writesCache, accumulator) {
	    const oldServerNode = viewCache.serverCache;
	    const newViewCache = viewCacheUpdateServerSnap(viewCache, oldServerNode.getNode(), oldServerNode.isFullyInitialized() || pathIsEmpty(path), oldServerNode.isFiltered());
	    return viewProcessorGenerateEventCacheAfterServerEvent(viewProcessor, newViewCache, path, writesCache, NO_COMPLETE_CHILD_SOURCE, accumulator);
	}
	function viewProcessorRevertUserWrite(viewProcessor, viewCache, path, writesCache, completeServerCache, accumulator) {
	    let complete;
	    if (writeTreeRefShadowingWrite(writesCache, path) != null) {
	        return viewCache;
	    }
	    else {
	        const source = new WriteTreeCompleteChildSource(writesCache, viewCache, completeServerCache);
	        const oldEventCache = viewCache.eventCache.getNode();
	        let newEventCache;
	        if (pathIsEmpty(path) || pathGetFront(path) === '.priority') {
	            let newNode;
	            if (viewCache.serverCache.isFullyInitialized()) {
	                newNode = writeTreeRefCalcCompleteEventCache(writesCache, viewCacheGetCompleteServerSnap(viewCache));
	            }
	            else {
	                const serverChildren = viewCache.serverCache.getNode();
	                assert(serverChildren instanceof ChildrenNode, 'serverChildren would be complete if leaf node');
	                newNode = writeTreeRefCalcCompleteEventChildren(writesCache, serverChildren);
	            }
	            newNode = newNode;
	            newEventCache = viewProcessor.filter.updateFullNode(oldEventCache, newNode, accumulator);
	        }
	        else {
	            const childKey = pathGetFront(path);
	            let newChild = writeTreeRefCalcCompleteChild(writesCache, childKey, viewCache.serverCache);
	            if (newChild == null &&
	                viewCache.serverCache.isCompleteForChild(childKey)) {
	                newChild = oldEventCache.getImmediateChild(childKey);
	            }
	            if (newChild != null) {
	                newEventCache = viewProcessor.filter.updateChild(oldEventCache, childKey, newChild, pathPopFront(path), source, accumulator);
	            }
	            else if (viewCache.eventCache.getNode().hasChild(childKey)) {
	                // No complete child available, delete the existing one, if any
	                newEventCache = viewProcessor.filter.updateChild(oldEventCache, childKey, ChildrenNode.EMPTY_NODE, pathPopFront(path), source, accumulator);
	            }
	            else {
	                newEventCache = oldEventCache;
	            }
	            if (newEventCache.isEmpty() &&
	                viewCache.serverCache.isFullyInitialized()) {
	                // We might have reverted all child writes. Maybe the old event was a leaf node
	                complete = writeTreeRefCalcCompleteEventCache(writesCache, viewCacheGetCompleteServerSnap(viewCache));
	                if (complete.isLeafNode()) {
	                    newEventCache = viewProcessor.filter.updateFullNode(newEventCache, complete, accumulator);
	                }
	            }
	        }
	        complete =
	            viewCache.serverCache.isFullyInitialized() ||
	                writeTreeRefShadowingWrite(writesCache, newEmptyPath()) != null;
	        return viewCacheUpdateEventSnap(viewCache, newEventCache, complete, viewProcessor.filter.filtersNodes());
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * A view represents a specific location and query that has 1 or more event registrations.
	 *
	 * It does several things:
	 *  - Maintains the list of event registrations for this location/query.
	 *  - Maintains a cache of the data visible for this location/query.
	 *  - Applies new operations (via applyOperation), updates the cache, and based on the event
	 *    registrations returns the set of events to be raised.
	 */
	class View {
	    constructor(query_, initialViewCache) {
	        this.query_ = query_;
	        this.eventRegistrations_ = [];
	        const params = this.query_._queryParams;
	        const indexFilter = new IndexedFilter(params.getIndex());
	        const filter = queryParamsGetNodeFilter(params);
	        this.processor_ = newViewProcessor(filter);
	        const initialServerCache = initialViewCache.serverCache;
	        const initialEventCache = initialViewCache.eventCache;
	        // Don't filter server node with other filter than index, wait for tagged listen
	        const serverSnap = indexFilter.updateFullNode(ChildrenNode.EMPTY_NODE, initialServerCache.getNode(), null);
	        const eventSnap = filter.updateFullNode(ChildrenNode.EMPTY_NODE, initialEventCache.getNode(), null);
	        const newServerCache = new CacheNode(serverSnap, initialServerCache.isFullyInitialized(), indexFilter.filtersNodes());
	        const newEventCache = new CacheNode(eventSnap, initialEventCache.isFullyInitialized(), filter.filtersNodes());
	        this.viewCache_ = newViewCache(newEventCache, newServerCache);
	        this.eventGenerator_ = new EventGenerator(this.query_);
	    }
	    get query() {
	        return this.query_;
	    }
	}
	function viewGetServerCache(view) {
	    return view.viewCache_.serverCache.getNode();
	}
	function viewGetCompleteNode(view) {
	    return viewCacheGetCompleteEventSnap(view.viewCache_);
	}
	function viewGetCompleteServerCache(view, path) {
	    const cache = viewCacheGetCompleteServerSnap(view.viewCache_);
	    if (cache) {
	        // If this isn't a "loadsAllData" view, then cache isn't actually a complete cache and
	        // we need to see if it contains the child we're interested in.
	        if (view.query._queryParams.loadsAllData() ||
	            (!pathIsEmpty(path) &&
	                !cache.getImmediateChild(pathGetFront(path)).isEmpty())) {
	            return cache.getChild(path);
	        }
	    }
	    return null;
	}
	function viewIsEmpty(view) {
	    return view.eventRegistrations_.length === 0;
	}
	function viewAddEventRegistration(view, eventRegistration) {
	    view.eventRegistrations_.push(eventRegistration);
	}
	/**
	 * @param eventRegistration - If null, remove all callbacks.
	 * @param cancelError - If a cancelError is provided, appropriate cancel events will be returned.
	 * @returns Cancel events, if cancelError was provided.
	 */
	function viewRemoveEventRegistration(view, eventRegistration, cancelError) {
	    const cancelEvents = [];
	    if (cancelError) {
	        assert(eventRegistration == null, 'A cancel should cancel all event registrations.');
	        const path = view.query._path;
	        view.eventRegistrations_.forEach(registration => {
	            const maybeEvent = registration.createCancelEvent(cancelError, path);
	            if (maybeEvent) {
	                cancelEvents.push(maybeEvent);
	            }
	        });
	    }
	    if (eventRegistration) {
	        let remaining = [];
	        for (let i = 0; i < view.eventRegistrations_.length; ++i) {
	            const existing = view.eventRegistrations_[i];
	            if (!existing.matches(eventRegistration)) {
	                remaining.push(existing);
	            }
	            else if (eventRegistration.hasAnyCallback()) {
	                // We're removing just this one
	                remaining = remaining.concat(view.eventRegistrations_.slice(i + 1));
	                break;
	            }
	        }
	        view.eventRegistrations_ = remaining;
	    }
	    else {
	        view.eventRegistrations_ = [];
	    }
	    return cancelEvents;
	}
	/**
	 * Applies the given Operation, updates our cache, and returns the appropriate events.
	 */
	function viewApplyOperation(view, operation, writesCache, completeServerCache) {
	    if (operation.type === OperationType.MERGE &&
	        operation.source.queryId !== null) {
	        assert(viewCacheGetCompleteServerSnap(view.viewCache_), 'We should always have a full cache before handling merges');
	        assert(viewCacheGetCompleteEventSnap(view.viewCache_), 'Missing event cache, even though we have a server cache');
	    }
	    const oldViewCache = view.viewCache_;
	    const result = viewProcessorApplyOperation(view.processor_, oldViewCache, operation, writesCache, completeServerCache);
	    viewProcessorAssertIndexed(view.processor_, result.viewCache);
	    assert(result.viewCache.serverCache.isFullyInitialized() ||
	        !oldViewCache.serverCache.isFullyInitialized(), 'Once a server snap is complete, it should never go back');
	    view.viewCache_ = result.viewCache;
	    return viewGenerateEventsForChanges_(view, result.changes, result.viewCache.eventCache.getNode(), null);
	}
	function viewGetInitialEvents(view, registration) {
	    const eventSnap = view.viewCache_.eventCache;
	    const initialChanges = [];
	    if (!eventSnap.getNode().isLeafNode()) {
	        const eventNode = eventSnap.getNode();
	        eventNode.forEachChild(PRIORITY_INDEX, (key, childNode) => {
	            initialChanges.push(changeChildAdded(key, childNode));
	        });
	    }
	    if (eventSnap.isFullyInitialized()) {
	        initialChanges.push(changeValue(eventSnap.getNode()));
	    }
	    return viewGenerateEventsForChanges_(view, initialChanges, eventSnap.getNode(), registration);
	}
	function viewGenerateEventsForChanges_(view, changes, eventCache, eventRegistration) {
	    const registrations = eventRegistration
	        ? [eventRegistration]
	        : view.eventRegistrations_;
	    return eventGeneratorGenerateEventsForChanges(view.eventGenerator_, changes, eventCache, registrations);
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	let referenceConstructor$1;
	/**
	 * SyncPoint represents a single location in a SyncTree with 1 or more event registrations, meaning we need to
	 * maintain 1 or more Views at this location to cache server data and raise appropriate events for server changes
	 * and user writes (set, transaction, update).
	 *
	 * It's responsible for:
	 *  - Maintaining the set of 1 or more views necessary at this location (a SyncPoint with 0 views should be removed).
	 *  - Proxying user / server operations to the views as appropriate (i.e. applyServerOverwrite,
	 *    applyUserOverwrite, etc.)
	 */
	class SyncPoint {
	    constructor() {
	        /**
	         * The Views being tracked at this location in the tree, stored as a map where the key is a
	         * queryId and the value is the View for that query.
	         *
	         * NOTE: This list will be quite small (usually 1, but perhaps 2 or 3; any more is an odd use case).
	         */
	        this.views = new Map();
	    }
	}
	function syncPointSetReferenceConstructor(val) {
	    assert(!referenceConstructor$1, '__referenceConstructor has already been defined');
	    referenceConstructor$1 = val;
	}
	function syncPointGetReferenceConstructor() {
	    assert(referenceConstructor$1, 'Reference.ts has not been loaded');
	    return referenceConstructor$1;
	}
	function syncPointIsEmpty(syncPoint) {
	    return syncPoint.views.size === 0;
	}
	function syncPointApplyOperation(syncPoint, operation, writesCache, optCompleteServerCache) {
	    const queryId = operation.source.queryId;
	    if (queryId !== null) {
	        const view = syncPoint.views.get(queryId);
	        assert(view != null, 'SyncTree gave us an op for an invalid query.');
	        return viewApplyOperation(view, operation, writesCache, optCompleteServerCache);
	    }
	    else {
	        let events = [];
	        for (const view of syncPoint.views.values()) {
	            events = events.concat(viewApplyOperation(view, operation, writesCache, optCompleteServerCache));
	        }
	        return events;
	    }
	}
	/**
	 * Get a view for the specified query.
	 *
	 * @param query - The query to return a view for
	 * @param writesCache
	 * @param serverCache
	 * @param serverCacheComplete
	 * @returns Events to raise.
	 */
	function syncPointGetView(syncPoint, query, writesCache, serverCache, serverCacheComplete) {
	    const queryId = query._queryIdentifier;
	    const view = syncPoint.views.get(queryId);
	    if (!view) {
	        // TODO: make writesCache take flag for complete server node
	        let eventCache = writeTreeRefCalcCompleteEventCache(writesCache, serverCacheComplete ? serverCache : null);
	        let eventCacheComplete = false;
	        if (eventCache) {
	            eventCacheComplete = true;
	        }
	        else if (serverCache instanceof ChildrenNode) {
	            eventCache = writeTreeRefCalcCompleteEventChildren(writesCache, serverCache);
	            eventCacheComplete = false;
	        }
	        else {
	            eventCache = ChildrenNode.EMPTY_NODE;
	            eventCacheComplete = false;
	        }
	        const viewCache = newViewCache(new CacheNode(eventCache, eventCacheComplete, false), new CacheNode(serverCache, serverCacheComplete, false));
	        return new View(query, viewCache);
	    }
	    return view;
	}
	/**
	 * Add an event callback for the specified query.
	 *
	 * @param query
	 * @param eventRegistration
	 * @param writesCache
	 * @param serverCache - Complete server cache, if we have it.
	 * @param serverCacheComplete
	 * @returns Events to raise.
	 */
	function syncPointAddEventRegistration(syncPoint, query, eventRegistration, writesCache, serverCache, serverCacheComplete) {
	    const view = syncPointGetView(syncPoint, query, writesCache, serverCache, serverCacheComplete);
	    if (!syncPoint.views.has(query._queryIdentifier)) {
	        syncPoint.views.set(query._queryIdentifier, view);
	    }
	    // This is guaranteed to exist now, we just created anything that was missing
	    viewAddEventRegistration(view, eventRegistration);
	    return viewGetInitialEvents(view, eventRegistration);
	}
	/**
	 * Remove event callback(s).  Return cancelEvents if a cancelError is specified.
	 *
	 * If query is the default query, we'll check all views for the specified eventRegistration.
	 * If eventRegistration is null, we'll remove all callbacks for the specified view(s).
	 *
	 * @param eventRegistration - If null, remove all callbacks.
	 * @param cancelError - If a cancelError is provided, appropriate cancel events will be returned.
	 * @returns removed queries and any cancel events
	 */
	function syncPointRemoveEventRegistration(syncPoint, query, eventRegistration, cancelError) {
	    const queryId = query._queryIdentifier;
	    const removed = [];
	    let cancelEvents = [];
	    const hadCompleteView = syncPointHasCompleteView(syncPoint);
	    if (queryId === 'default') {
	        // When you do ref.off(...), we search all views for the registration to remove.
	        for (const [viewQueryId, view] of syncPoint.views.entries()) {
	            cancelEvents = cancelEvents.concat(viewRemoveEventRegistration(view, eventRegistration, cancelError));
	            if (viewIsEmpty(view)) {
	                syncPoint.views.delete(viewQueryId);
	                // We'll deal with complete views later.
	                if (!view.query._queryParams.loadsAllData()) {
	                    removed.push(view.query);
	                }
	            }
	        }
	    }
	    else {
	        // remove the callback from the specific view.
	        const view = syncPoint.views.get(queryId);
	        if (view) {
	            cancelEvents = cancelEvents.concat(viewRemoveEventRegistration(view, eventRegistration, cancelError));
	            if (viewIsEmpty(view)) {
	                syncPoint.views.delete(queryId);
	                // We'll deal with complete views later.
	                if (!view.query._queryParams.loadsAllData()) {
	                    removed.push(view.query);
	                }
	            }
	        }
	    }
	    if (hadCompleteView && !syncPointHasCompleteView(syncPoint)) {
	        // We removed our last complete view.
	        removed.push(new (syncPointGetReferenceConstructor())(query._repo, query._path));
	    }
	    return { removed, events: cancelEvents };
	}
	function syncPointGetQueryViews(syncPoint) {
	    const result = [];
	    for (const view of syncPoint.views.values()) {
	        if (!view.query._queryParams.loadsAllData()) {
	            result.push(view);
	        }
	    }
	    return result;
	}
	/**
	 * @param path - The path to the desired complete snapshot
	 * @returns A complete cache, if it exists
	 */
	function syncPointGetCompleteServerCache(syncPoint, path) {
	    let serverCache = null;
	    for (const view of syncPoint.views.values()) {
	        serverCache = serverCache || viewGetCompleteServerCache(view, path);
	    }
	    return serverCache;
	}
	function syncPointViewForQuery(syncPoint, query) {
	    const params = query._queryParams;
	    if (params.loadsAllData()) {
	        return syncPointGetCompleteView(syncPoint);
	    }
	    else {
	        const queryId = query._queryIdentifier;
	        return syncPoint.views.get(queryId);
	    }
	}
	function syncPointViewExistsForQuery(syncPoint, query) {
	    return syncPointViewForQuery(syncPoint, query) != null;
	}
	function syncPointHasCompleteView(syncPoint) {
	    return syncPointGetCompleteView(syncPoint) != null;
	}
	function syncPointGetCompleteView(syncPoint) {
	    for (const view of syncPoint.views.values()) {
	        if (view.query._queryParams.loadsAllData()) {
	            return view;
	        }
	    }
	    return null;
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	let referenceConstructor;
	function syncTreeSetReferenceConstructor(val) {
	    assert(!referenceConstructor, '__referenceConstructor has already been defined');
	    referenceConstructor = val;
	}
	function syncTreeGetReferenceConstructor() {
	    assert(referenceConstructor, 'Reference.ts has not been loaded');
	    return referenceConstructor;
	}
	/**
	 * Static tracker for next query tag.
	 */
	let syncTreeNextQueryTag_ = 1;
	/**
	 * SyncTree is the central class for managing event callback registration, data caching, views
	 * (query processing), and event generation.  There are typically two SyncTree instances for
	 * each Repo, one for the normal Firebase data, and one for the .info data.
	 *
	 * It has a number of responsibilities, including:
	 *  - Tracking all user event callbacks (registered via addEventRegistration() and removeEventRegistration()).
	 *  - Applying and caching data changes for user set(), transaction(), and update() calls
	 *    (applyUserOverwrite(), applyUserMerge()).
	 *  - Applying and caching data changes for server data changes (applyServerOverwrite(),
	 *    applyServerMerge()).
	 *  - Generating user-facing events for server and user changes (all of the apply* methods
	 *    return the set of events that need to be raised as a result).
	 *  - Maintaining the appropriate set of server listens to ensure we are always subscribed
	 *    to the correct set of paths and queries to satisfy the current set of user event
	 *    callbacks (listens are started/stopped using the provided listenProvider).
	 *
	 * NOTE: Although SyncTree tracks event callbacks and calculates events to raise, the actual
	 * events are returned to the caller rather than raised synchronously.
	 *
	 */
	class SyncTree {
	    /**
	     * @param listenProvider_ - Used by SyncTree to start / stop listening
	     *   to server data.
	     */
	    constructor(listenProvider_) {
	        this.listenProvider_ = listenProvider_;
	        /**
	         * Tree of SyncPoints.  There's a SyncPoint at any location that has 1 or more views.
	         */
	        this.syncPointTree_ = new ImmutableTree(null);
	        /**
	         * A tree of all pending user writes (user-initiated set()'s, transaction()'s, update()'s, etc.).
	         */
	        this.pendingWriteTree_ = newWriteTree();
	        this.tagToQueryMap = new Map();
	        this.queryToTagMap = new Map();
	    }
	}
	/**
	 * Apply the data changes for a user-generated set() or transaction() call.
	 *
	 * @returns Events to raise.
	 */
	function syncTreeApplyUserOverwrite(syncTree, path, newData, writeId, visible) {
	    // Record pending write.
	    writeTreeAddOverwrite(syncTree.pendingWriteTree_, path, newData, writeId, visible);
	    if (!visible) {
	        return [];
	    }
	    else {
	        return syncTreeApplyOperationToSyncPoints_(syncTree, new Overwrite(newOperationSourceUser(), path, newData));
	    }
	}
	/**
	 * Acknowledge a pending user write that was previously registered with applyUserOverwrite() or applyUserMerge().
	 *
	 * @param revert - True if the given write failed and needs to be reverted
	 * @returns Events to raise.
	 */
	function syncTreeAckUserWrite(syncTree, writeId, revert = false) {
	    const write = writeTreeGetWrite(syncTree.pendingWriteTree_, writeId);
	    const needToReevaluate = writeTreeRemoveWrite(syncTree.pendingWriteTree_, writeId);
	    if (!needToReevaluate) {
	        return [];
	    }
	    else {
	        let affectedTree = new ImmutableTree(null);
	        if (write.snap != null) {
	            // overwrite
	            affectedTree = affectedTree.set(newEmptyPath(), true);
	        }
	        else {
	            each(write.children, (pathString) => {
	                affectedTree = affectedTree.set(new Path(pathString), true);
	            });
	        }
	        return syncTreeApplyOperationToSyncPoints_(syncTree, new AckUserWrite(write.path, affectedTree, revert));
	    }
	}
	/**
	 * Apply new server data for the specified path..
	 *
	 * @returns Events to raise.
	 */
	function syncTreeApplyServerOverwrite(syncTree, path, newData) {
	    return syncTreeApplyOperationToSyncPoints_(syncTree, new Overwrite(newOperationSourceServer(), path, newData));
	}
	/**
	 * Apply new server data to be merged in at the specified path.
	 *
	 * @returns Events to raise.
	 */
	function syncTreeApplyServerMerge(syncTree, path, changedChildren) {
	    const changeTree = ImmutableTree.fromObject(changedChildren);
	    return syncTreeApplyOperationToSyncPoints_(syncTree, new Merge(newOperationSourceServer(), path, changeTree));
	}
	/**
	 * Apply a listen complete for a query
	 *
	 * @returns Events to raise.
	 */
	function syncTreeApplyListenComplete(syncTree, path) {
	    return syncTreeApplyOperationToSyncPoints_(syncTree, new ListenComplete(newOperationSourceServer(), path));
	}
	/**
	 * Apply a listen complete for a tagged query
	 *
	 * @returns Events to raise.
	 */
	function syncTreeApplyTaggedListenComplete(syncTree, path, tag) {
	    const queryKey = syncTreeQueryKeyForTag_(syncTree, tag);
	    if (queryKey) {
	        const r = syncTreeParseQueryKey_(queryKey);
	        const queryPath = r.path, queryId = r.queryId;
	        const relativePath = newRelativePath(queryPath, path);
	        const op = new ListenComplete(newOperationSourceServerTaggedQuery(queryId), relativePath);
	        return syncTreeApplyTaggedOperation_(syncTree, queryPath, op);
	    }
	    else {
	        // We've already removed the query. No big deal, ignore the update
	        return [];
	    }
	}
	/**
	 * Remove event callback(s).
	 *
	 * If query is the default query, we'll check all queries for the specified eventRegistration.
	 * If eventRegistration is null, we'll remove all callbacks for the specified query/queries.
	 *
	 * @param eventRegistration - If null, all callbacks are removed.
	 * @param cancelError - If a cancelError is provided, appropriate cancel events will be returned.
	 * @param skipListenerDedup - When performing a `get()`, we don't add any new listeners, so no
	 *  deduping needs to take place. This flag allows toggling of that behavior
	 * @returns Cancel events, if cancelError was provided.
	 */
	function syncTreeRemoveEventRegistration(syncTree, query, eventRegistration, cancelError, skipListenerDedup = false) {
	    // Find the syncPoint first. Then deal with whether or not it has matching listeners
	    const path = query._path;
	    const maybeSyncPoint = syncTree.syncPointTree_.get(path);
	    let cancelEvents = [];
	    // A removal on a default query affects all queries at that location. A removal on an indexed query, even one without
	    // other query constraints, does *not* affect all queries at that location. So this check must be for 'default', and
	    // not loadsAllData().
	    if (maybeSyncPoint &&
	        (query._queryIdentifier === 'default' ||
	            syncPointViewExistsForQuery(maybeSyncPoint, query))) {
	        const removedAndEvents = syncPointRemoveEventRegistration(maybeSyncPoint, query, eventRegistration, cancelError);
	        if (syncPointIsEmpty(maybeSyncPoint)) {
	            syncTree.syncPointTree_ = syncTree.syncPointTree_.remove(path);
	        }
	        const removed = removedAndEvents.removed;
	        cancelEvents = removedAndEvents.events;
	        if (!skipListenerDedup) {
	            /**
	             * We may have just removed one of many listeners and can short-circuit this whole process
	             * We may also not have removed a default listener, in which case all of the descendant listeners should already be
	             * properly set up.
	             */
	            // Since indexed queries can shadow if they don't have other query constraints, check for loadsAllData(), instead of
	            // queryId === 'default'
	            const removingDefault = -1 !==
	                removed.findIndex(query => {
	                    return query._queryParams.loadsAllData();
	                });
	            const covered = syncTree.syncPointTree_.findOnPath(path, (relativePath, parentSyncPoint) => syncPointHasCompleteView(parentSyncPoint));
	            if (removingDefault && !covered) {
	                const subtree = syncTree.syncPointTree_.subtree(path);
	                // There are potentially child listeners. Determine what if any listens we need to send before executing the
	                // removal
	                if (!subtree.isEmpty()) {
	                    // We need to fold over our subtree and collect the listeners to send
	                    const newViews = syncTreeCollectDistinctViewsForSubTree_(subtree);
	                    // Ok, we've collected all the listens we need. Set them up.
	                    for (let i = 0; i < newViews.length; ++i) {
	                        const view = newViews[i], newQuery = view.query;
	                        const listener = syncTreeCreateListenerForView_(syncTree, view);
	                        syncTree.listenProvider_.startListening(syncTreeQueryForListening_(newQuery), syncTreeTagForQuery(syncTree, newQuery), listener.hashFn, listener.onComplete);
	                    }
	                }
	                // Otherwise there's nothing below us, so nothing we need to start listening on
	            }
	            // If we removed anything and we're not covered by a higher up listen, we need to stop listening on this query
	            // The above block has us covered in terms of making sure we're set up on listens lower in the tree.
	            // Also, note that if we have a cancelError, it's already been removed at the provider level.
	            if (!covered && removed.length > 0 && !cancelError) {
	                // If we removed a default, then we weren't listening on any of the other queries here. Just cancel the one
	                // default. Otherwise, we need to iterate through and cancel each individual query
	                if (removingDefault) {
	                    // We don't tag default listeners
	                    const defaultTag = null;
	                    syncTree.listenProvider_.stopListening(syncTreeQueryForListening_(query), defaultTag);
	                }
	                else {
	                    removed.forEach((queryToRemove) => {
	                        const tagToRemove = syncTree.queryToTagMap.get(syncTreeMakeQueryKey_(queryToRemove));
	                        syncTree.listenProvider_.stopListening(syncTreeQueryForListening_(queryToRemove), tagToRemove);
	                    });
	                }
	            }
	        }
	        // Now, clear all of the tags we're tracking for the removed listens
	        syncTreeRemoveTags_(syncTree, removed);
	    }
	    return cancelEvents;
	}
	/**
	 * Apply new server data for the specified tagged query.
	 *
	 * @returns Events to raise.
	 */
	function syncTreeApplyTaggedQueryOverwrite(syncTree, path, snap, tag) {
	    const queryKey = syncTreeQueryKeyForTag_(syncTree, tag);
	    if (queryKey != null) {
	        const r = syncTreeParseQueryKey_(queryKey);
	        const queryPath = r.path, queryId = r.queryId;
	        const relativePath = newRelativePath(queryPath, path);
	        const op = new Overwrite(newOperationSourceServerTaggedQuery(queryId), relativePath, snap);
	        return syncTreeApplyTaggedOperation_(syncTree, queryPath, op);
	    }
	    else {
	        // Query must have been removed already
	        return [];
	    }
	}
	/**
	 * Apply server data to be merged in for the specified tagged query.
	 *
	 * @returns Events to raise.
	 */
	function syncTreeApplyTaggedQueryMerge(syncTree, path, changedChildren, tag) {
	    const queryKey = syncTreeQueryKeyForTag_(syncTree, tag);
	    if (queryKey) {
	        const r = syncTreeParseQueryKey_(queryKey);
	        const queryPath = r.path, queryId = r.queryId;
	        const relativePath = newRelativePath(queryPath, path);
	        const changeTree = ImmutableTree.fromObject(changedChildren);
	        const op = new Merge(newOperationSourceServerTaggedQuery(queryId), relativePath, changeTree);
	        return syncTreeApplyTaggedOperation_(syncTree, queryPath, op);
	    }
	    else {
	        // We've already removed the query. No big deal, ignore the update
	        return [];
	    }
	}
	/**
	 * Add an event callback for the specified query.
	 *
	 * @returns Events to raise.
	 */
	function syncTreeAddEventRegistration(syncTree, query, eventRegistration, skipSetupListener = false) {
	    const path = query._path;
	    let serverCache = null;
	    let foundAncestorDefaultView = false;
	    // Any covering writes will necessarily be at the root, so really all we need to find is the server cache.
	    // Consider optimizing this once there's a better understanding of what actual behavior will be.
	    syncTree.syncPointTree_.foreachOnPath(path, (pathToSyncPoint, sp) => {
	        const relativePath = newRelativePath(pathToSyncPoint, path);
	        serverCache =
	            serverCache || syncPointGetCompleteServerCache(sp, relativePath);
	        foundAncestorDefaultView =
	            foundAncestorDefaultView || syncPointHasCompleteView(sp);
	    });
	    let syncPoint = syncTree.syncPointTree_.get(path);
	    if (!syncPoint) {
	        syncPoint = new SyncPoint();
	        syncTree.syncPointTree_ = syncTree.syncPointTree_.set(path, syncPoint);
	    }
	    else {
	        foundAncestorDefaultView =
	            foundAncestorDefaultView || syncPointHasCompleteView(syncPoint);
	        serverCache =
	            serverCache || syncPointGetCompleteServerCache(syncPoint, newEmptyPath());
	    }
	    let serverCacheComplete;
	    if (serverCache != null) {
	        serverCacheComplete = true;
	    }
	    else {
	        serverCacheComplete = false;
	        serverCache = ChildrenNode.EMPTY_NODE;
	        const subtree = syncTree.syncPointTree_.subtree(path);
	        subtree.foreachChild((childName, childSyncPoint) => {
	            const completeCache = syncPointGetCompleteServerCache(childSyncPoint, newEmptyPath());
	            if (completeCache) {
	                serverCache = serverCache.updateImmediateChild(childName, completeCache);
	            }
	        });
	    }
	    const viewAlreadyExists = syncPointViewExistsForQuery(syncPoint, query);
	    if (!viewAlreadyExists && !query._queryParams.loadsAllData()) {
	        // We need to track a tag for this query
	        const queryKey = syncTreeMakeQueryKey_(query);
	        assert(!syncTree.queryToTagMap.has(queryKey), 'View does not exist, but we have a tag');
	        const tag = syncTreeGetNextQueryTag_();
	        syncTree.queryToTagMap.set(queryKey, tag);
	        syncTree.tagToQueryMap.set(tag, queryKey);
	    }
	    const writesCache = writeTreeChildWrites(syncTree.pendingWriteTree_, path);
	    let events = syncPointAddEventRegistration(syncPoint, query, eventRegistration, writesCache, serverCache, serverCacheComplete);
	    if (!viewAlreadyExists && !foundAncestorDefaultView && !skipSetupListener) {
	        const view = syncPointViewForQuery(syncPoint, query);
	        events = events.concat(syncTreeSetupListener_(syncTree, query, view));
	    }
	    return events;
	}
	/**
	 * Returns a complete cache, if we have one, of the data at a particular path. If the location does not have a
	 * listener above it, we will get a false "null". This shouldn't be a problem because transactions will always
	 * have a listener above, and atomic operations would correctly show a jitter of <increment value> ->
	 *     <incremented total> as the write is applied locally and then acknowledged at the server.
	 *
	 * Note: this method will *include* hidden writes from transaction with applyLocally set to false.
	 *
	 * @param path - The path to the data we want
	 * @param writeIdsToExclude - A specific set to be excluded
	 */
	function syncTreeCalcCompleteEventCache(syncTree, path, writeIdsToExclude) {
	    const includeHiddenSets = true;
	    const writeTree = syncTree.pendingWriteTree_;
	    const serverCache = syncTree.syncPointTree_.findOnPath(path, (pathSoFar, syncPoint) => {
	        const relativePath = newRelativePath(pathSoFar, path);
	        const serverCache = syncPointGetCompleteServerCache(syncPoint, relativePath);
	        if (serverCache) {
	            return serverCache;
	        }
	    });
	    return writeTreeCalcCompleteEventCache(writeTree, path, serverCache, writeIdsToExclude, includeHiddenSets);
	}
	function syncTreeGetServerValue(syncTree, query) {
	    const path = query._path;
	    let serverCache = null;
	    // Any covering writes will necessarily be at the root, so really all we need to find is the server cache.
	    // Consider optimizing this once there's a better understanding of what actual behavior will be.
	    syncTree.syncPointTree_.foreachOnPath(path, (pathToSyncPoint, sp) => {
	        const relativePath = newRelativePath(pathToSyncPoint, path);
	        serverCache =
	            serverCache || syncPointGetCompleteServerCache(sp, relativePath);
	    });
	    let syncPoint = syncTree.syncPointTree_.get(path);
	    if (!syncPoint) {
	        syncPoint = new SyncPoint();
	        syncTree.syncPointTree_ = syncTree.syncPointTree_.set(path, syncPoint);
	    }
	    else {
	        serverCache =
	            serverCache || syncPointGetCompleteServerCache(syncPoint, newEmptyPath());
	    }
	    const serverCacheComplete = serverCache != null;
	    const serverCacheNode = serverCacheComplete
	        ? new CacheNode(serverCache, true, false)
	        : null;
	    const writesCache = writeTreeChildWrites(syncTree.pendingWriteTree_, query._path);
	    const view = syncPointGetView(syncPoint, query, writesCache, serverCacheComplete ? serverCacheNode.getNode() : ChildrenNode.EMPTY_NODE, serverCacheComplete);
	    return viewGetCompleteNode(view);
	}
	/**
	 * A helper method that visits all descendant and ancestor SyncPoints, applying the operation.
	 *
	 * NOTES:
	 * - Descendant SyncPoints will be visited first (since we raise events depth-first).
	 *
	 * - We call applyOperation() on each SyncPoint passing three things:
	 *   1. A version of the Operation that has been made relative to the SyncPoint location.
	 *   2. A WriteTreeRef of any writes we have cached at the SyncPoint location.
	 *   3. A snapshot Node with cached server data, if we have it.
	 *
	 * - We concatenate all of the events returned by each SyncPoint and return the result.
	 */
	function syncTreeApplyOperationToSyncPoints_(syncTree, operation) {
	    return syncTreeApplyOperationHelper_(operation, syncTree.syncPointTree_, 
	    /*serverCache=*/ null, writeTreeChildWrites(syncTree.pendingWriteTree_, newEmptyPath()));
	}
	/**
	 * Recursive helper for applyOperationToSyncPoints_
	 */
	function syncTreeApplyOperationHelper_(operation, syncPointTree, serverCache, writesCache) {
	    if (pathIsEmpty(operation.path)) {
	        return syncTreeApplyOperationDescendantsHelper_(operation, syncPointTree, serverCache, writesCache);
	    }
	    else {
	        const syncPoint = syncPointTree.get(newEmptyPath());
	        // If we don't have cached server data, see if we can get it from this SyncPoint.
	        if (serverCache == null && syncPoint != null) {
	            serverCache = syncPointGetCompleteServerCache(syncPoint, newEmptyPath());
	        }
	        let events = [];
	        const childName = pathGetFront(operation.path);
	        const childOperation = operation.operationForChild(childName);
	        const childTree = syncPointTree.children.get(childName);
	        if (childTree && childOperation) {
	            const childServerCache = serverCache
	                ? serverCache.getImmediateChild(childName)
	                : null;
	            const childWritesCache = writeTreeRefChild(writesCache, childName);
	            events = events.concat(syncTreeApplyOperationHelper_(childOperation, childTree, childServerCache, childWritesCache));
	        }
	        if (syncPoint) {
	            events = events.concat(syncPointApplyOperation(syncPoint, operation, writesCache, serverCache));
	        }
	        return events;
	    }
	}
	/**
	 * Recursive helper for applyOperationToSyncPoints_
	 */
	function syncTreeApplyOperationDescendantsHelper_(operation, syncPointTree, serverCache, writesCache) {
	    const syncPoint = syncPointTree.get(newEmptyPath());
	    // If we don't have cached server data, see if we can get it from this SyncPoint.
	    if (serverCache == null && syncPoint != null) {
	        serverCache = syncPointGetCompleteServerCache(syncPoint, newEmptyPath());
	    }
	    let events = [];
	    syncPointTree.children.inorderTraversal((childName, childTree) => {
	        const childServerCache = serverCache
	            ? serverCache.getImmediateChild(childName)
	            : null;
	        const childWritesCache = writeTreeRefChild(writesCache, childName);
	        const childOperation = operation.operationForChild(childName);
	        if (childOperation) {
	            events = events.concat(syncTreeApplyOperationDescendantsHelper_(childOperation, childTree, childServerCache, childWritesCache));
	        }
	    });
	    if (syncPoint) {
	        events = events.concat(syncPointApplyOperation(syncPoint, operation, writesCache, serverCache));
	    }
	    return events;
	}
	function syncTreeCreateListenerForView_(syncTree, view) {
	    const query = view.query;
	    const tag = syncTreeTagForQuery(syncTree, query);
	    return {
	        hashFn: () => {
	            const cache = viewGetServerCache(view) || ChildrenNode.EMPTY_NODE;
	            return cache.hash();
	        },
	        onComplete: (status) => {
	            if (status === 'ok') {
	                if (tag) {
	                    return syncTreeApplyTaggedListenComplete(syncTree, query._path, tag);
	                }
	                else {
	                    return syncTreeApplyListenComplete(syncTree, query._path);
	                }
	            }
	            else {
	                // If a listen failed, kill all of the listeners here, not just the one that triggered the error.
	                // Note that this may need to be scoped to just this listener if we change permissions on filtered children
	                const error = errorForServerCode(status, query);
	                return syncTreeRemoveEventRegistration(syncTree, query, 
	                /*eventRegistration*/ null, error);
	            }
	        }
	    };
	}
	/**
	 * Return the tag associated with the given query.
	 */
	function syncTreeTagForQuery(syncTree, query) {
	    const queryKey = syncTreeMakeQueryKey_(query);
	    return syncTree.queryToTagMap.get(queryKey);
	}
	/**
	 * Given a query, computes a "queryKey" suitable for use in our queryToTagMap_.
	 */
	function syncTreeMakeQueryKey_(query) {
	    return query._path.toString() + '$' + query._queryIdentifier;
	}
	/**
	 * Return the query associated with the given tag, if we have one
	 */
	function syncTreeQueryKeyForTag_(syncTree, tag) {
	    return syncTree.tagToQueryMap.get(tag);
	}
	/**
	 * Given a queryKey (created by makeQueryKey), parse it back into a path and queryId.
	 */
	function syncTreeParseQueryKey_(queryKey) {
	    const splitIndex = queryKey.indexOf('$');
	    assert(splitIndex !== -1 && splitIndex < queryKey.length - 1, 'Bad queryKey.');
	    return {
	        queryId: queryKey.substr(splitIndex + 1),
	        path: new Path(queryKey.substr(0, splitIndex))
	    };
	}
	/**
	 * A helper method to apply tagged operations
	 */
	function syncTreeApplyTaggedOperation_(syncTree, queryPath, operation) {
	    const syncPoint = syncTree.syncPointTree_.get(queryPath);
	    assert(syncPoint, "Missing sync point for query tag that we're tracking");
	    const writesCache = writeTreeChildWrites(syncTree.pendingWriteTree_, queryPath);
	    return syncPointApplyOperation(syncPoint, operation, writesCache, null);
	}
	/**
	 * This collapses multiple unfiltered views into a single view, since we only need a single
	 * listener for them.
	 */
	function syncTreeCollectDistinctViewsForSubTree_(subtree) {
	    return subtree.fold((relativePath, maybeChildSyncPoint, childMap) => {
	        if (maybeChildSyncPoint && syncPointHasCompleteView(maybeChildSyncPoint)) {
	            const completeView = syncPointGetCompleteView(maybeChildSyncPoint);
	            return [completeView];
	        }
	        else {
	            // No complete view here, flatten any deeper listens into an array
	            let views = [];
	            if (maybeChildSyncPoint) {
	                views = syncPointGetQueryViews(maybeChildSyncPoint);
	            }
	            each(childMap, (_key, childViews) => {
	                views = views.concat(childViews);
	            });
	            return views;
	        }
	    });
	}
	/**
	 * Normalizes a query to a query we send the server for listening
	 *
	 * @returns The normalized query
	 */
	function syncTreeQueryForListening_(query) {
	    if (query._queryParams.loadsAllData() && !query._queryParams.isDefault()) {
	        // We treat queries that load all data as default queries
	        // Cast is necessary because ref() technically returns Firebase which is actually fb.api.Firebase which inherits
	        // from Query
	        return new (syncTreeGetReferenceConstructor())(query._repo, query._path);
	    }
	    else {
	        return query;
	    }
	}
	function syncTreeRemoveTags_(syncTree, queries) {
	    for (let j = 0; j < queries.length; ++j) {
	        const removedQuery = queries[j];
	        if (!removedQuery._queryParams.loadsAllData()) {
	            // We should have a tag for this
	            const removedQueryKey = syncTreeMakeQueryKey_(removedQuery);
	            const removedQueryTag = syncTree.queryToTagMap.get(removedQueryKey);
	            syncTree.queryToTagMap.delete(removedQueryKey);
	            syncTree.tagToQueryMap.delete(removedQueryTag);
	        }
	    }
	}
	/**
	 * Static accessor for query tags.
	 */
	function syncTreeGetNextQueryTag_() {
	    return syncTreeNextQueryTag_++;
	}
	/**
	 * For a given new listen, manage the de-duplication of outstanding subscriptions.
	 *
	 * @returns This method can return events to support synchronous data sources
	 */
	function syncTreeSetupListener_(syncTree, query, view) {
	    const path = query._path;
	    const tag = syncTreeTagForQuery(syncTree, query);
	    const listener = syncTreeCreateListenerForView_(syncTree, view);
	    const events = syncTree.listenProvider_.startListening(syncTreeQueryForListening_(query), tag, listener.hashFn, listener.onComplete);
	    const subtree = syncTree.syncPointTree_.subtree(path);
	    // The root of this subtree has our query. We're here because we definitely need to send a listen for that, but we
	    // may need to shadow other listens as well.
	    if (tag) {
	        assert(!syncPointHasCompleteView(subtree.value), "If we're adding a query, it shouldn't be shadowed");
	    }
	    else {
	        // Shadow everything at or below this location, this is a default listener.
	        const queriesToStop = subtree.fold((relativePath, maybeChildSyncPoint, childMap) => {
	            if (!pathIsEmpty(relativePath) &&
	                maybeChildSyncPoint &&
	                syncPointHasCompleteView(maybeChildSyncPoint)) {
	                return [syncPointGetCompleteView(maybeChildSyncPoint).query];
	            }
	            else {
	                // No default listener here, flatten any deeper queries into an array
	                let queries = [];
	                if (maybeChildSyncPoint) {
	                    queries = queries.concat(syncPointGetQueryViews(maybeChildSyncPoint).map(view => view.query));
	                }
	                each(childMap, (_key, childQueries) => {
	                    queries = queries.concat(childQueries);
	                });
	                return queries;
	            }
	        });
	        for (let i = 0; i < queriesToStop.length; ++i) {
	            const queryToStop = queriesToStop[i];
	            syncTree.listenProvider_.stopListening(syncTreeQueryForListening_(queryToStop), syncTreeTagForQuery(syncTree, queryToStop));
	        }
	    }
	    return events;
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	class ExistingValueProvider {
	    constructor(node_) {
	        this.node_ = node_;
	    }
	    getImmediateChild(childName) {
	        const child = this.node_.getImmediateChild(childName);
	        return new ExistingValueProvider(child);
	    }
	    node() {
	        return this.node_;
	    }
	}
	class DeferredValueProvider {
	    constructor(syncTree, path) {
	        this.syncTree_ = syncTree;
	        this.path_ = path;
	    }
	    getImmediateChild(childName) {
	        const childPath = pathChild(this.path_, childName);
	        return new DeferredValueProvider(this.syncTree_, childPath);
	    }
	    node() {
	        return syncTreeCalcCompleteEventCache(this.syncTree_, this.path_);
	    }
	}
	/**
	 * Generate placeholders for deferred values.
	 */
	const generateWithValues = function (values) {
	    values = values || {};
	    values['timestamp'] = values['timestamp'] || new Date().getTime();
	    return values;
	};
	/**
	 * Value to use when firing local events. When writing server values, fire
	 * local events with an approximate value, otherwise return value as-is.
	 */
	const resolveDeferredLeafValue = function (value, existingVal, serverValues) {
	    if (!value || typeof value !== 'object') {
	        return value;
	    }
	    assert('.sv' in value, 'Unexpected leaf node or priority contents');
	    if (typeof value['.sv'] === 'string') {
	        return resolveScalarDeferredValue(value['.sv'], existingVal, serverValues);
	    }
	    else if (typeof value['.sv'] === 'object') {
	        return resolveComplexDeferredValue(value['.sv'], existingVal);
	    }
	    else {
	        assert(false, 'Unexpected server value: ' + JSON.stringify(value, null, 2));
	    }
	};
	const resolveScalarDeferredValue = function (op, existing, serverValues) {
	    switch (op) {
	        case 'timestamp':
	            return serverValues['timestamp'];
	        default:
	            assert(false, 'Unexpected server value: ' + op);
	    }
	};
	const resolveComplexDeferredValue = function (op, existing, unused) {
	    if (!op.hasOwnProperty('increment')) {
	        assert(false, 'Unexpected server value: ' + JSON.stringify(op, null, 2));
	    }
	    const delta = op['increment'];
	    if (typeof delta !== 'number') {
	        assert(false, 'Unexpected increment value: ' + delta);
	    }
	    const existingNode = existing.node();
	    assert(existingNode !== null && typeof existingNode !== 'undefined', 'Expected ChildrenNode.EMPTY_NODE for nulls');
	    // Incrementing a non-number sets the value to the incremented amount
	    if (!existingNode.isLeafNode()) {
	        return delta;
	    }
	    const leaf = existingNode;
	    const existingVal = leaf.getValue();
	    if (typeof existingVal !== 'number') {
	        return delta;
	    }
	    // No need to do over/underflow arithmetic here because JS only handles floats under the covers
	    return existingVal + delta;
	};
	/**
	 * Recursively replace all deferred values and priorities in the tree with the
	 * specified generated replacement values.
	 * @param path - path to which write is relative
	 * @param node - new data written at path
	 * @param syncTree - current data
	 */
	const resolveDeferredValueTree = function (path, node, syncTree, serverValues) {
	    return resolveDeferredValue(node, new DeferredValueProvider(syncTree, path), serverValues);
	};
	/**
	 * Recursively replace all deferred values and priorities in the node with the
	 * specified generated replacement values.  If there are no server values in the node,
	 * it'll be returned as-is.
	 */
	const resolveDeferredValueSnapshot = function (node, existing, serverValues) {
	    return resolveDeferredValue(node, new ExistingValueProvider(existing), serverValues);
	};
	function resolveDeferredValue(node, existingVal, serverValues) {
	    const rawPri = node.getPriority().val();
	    const priority = resolveDeferredLeafValue(rawPri, existingVal.getImmediateChild('.priority'), serverValues);
	    let newNode;
	    if (node.isLeafNode()) {
	        const leafNode = node;
	        const value = resolveDeferredLeafValue(leafNode.getValue(), existingVal, serverValues);
	        if (value !== leafNode.getValue() ||
	            priority !== leafNode.getPriority().val()) {
	            return new LeafNode(value, nodeFromJSON(priority));
	        }
	        else {
	            return node;
	        }
	    }
	    else {
	        const childrenNode = node;
	        newNode = childrenNode;
	        if (priority !== childrenNode.getPriority().val()) {
	            newNode = newNode.updatePriority(new LeafNode(priority));
	        }
	        childrenNode.forEachChild(PRIORITY_INDEX, (childName, childNode) => {
	            const newChildNode = resolveDeferredValue(childNode, existingVal.getImmediateChild(childName), serverValues);
	            if (newChildNode !== childNode) {
	                newNode = newNode.updateImmediateChild(childName, newChildNode);
	            }
	        });
	        return newNode;
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * A light-weight tree, traversable by path.  Nodes can have both values and children.
	 * Nodes are not enumerated (by forEachChild) unless they have a value or non-empty
	 * children.
	 */
	class Tree {
	    /**
	     * @param name - Optional name of the node.
	     * @param parent - Optional parent node.
	     * @param node - Optional node to wrap.
	     */
	    constructor(name = '', parent = null, node = { children: {}, childCount: 0 }) {
	        this.name = name;
	        this.parent = parent;
	        this.node = node;
	    }
	}
	/**
	 * Returns a sub-Tree for the given path.
	 *
	 * @param pathObj - Path to look up.
	 * @returns Tree for path.
	 */
	function treeSubTree(tree, pathObj) {
	    // TODO: Require pathObj to be Path?
	    let path = pathObj instanceof Path ? pathObj : new Path(pathObj);
	    let child = tree, next = pathGetFront(path);
	    while (next !== null) {
	        const childNode = safeGet(child.node.children, next) || {
	            children: {},
	            childCount: 0
	        };
	        child = new Tree(next, child, childNode);
	        path = pathPopFront(path);
	        next = pathGetFront(path);
	    }
	    return child;
	}
	/**
	 * Returns the data associated with this tree node.
	 *
	 * @returns The data or null if no data exists.
	 */
	function treeGetValue(tree) {
	    return tree.node.value;
	}
	/**
	 * Sets data to this tree node.
	 *
	 * @param value - Value to set.
	 */
	function treeSetValue(tree, value) {
	    tree.node.value = value;
	    treeUpdateParents(tree);
	}
	/**
	 * @returns Whether the tree has any children.
	 */
	function treeHasChildren(tree) {
	    return tree.node.childCount > 0;
	}
	/**
	 * @returns Whether the tree is empty (no value or children).
	 */
	function treeIsEmpty(tree) {
	    return treeGetValue(tree) === undefined && !treeHasChildren(tree);
	}
	/**
	 * Calls action for each child of this tree node.
	 *
	 * @param action - Action to be called for each child.
	 */
	function treeForEachChild(tree, action) {
	    each(tree.node.children, (child, childTree) => {
	        action(new Tree(child, tree, childTree));
	    });
	}
	/**
	 * Does a depth-first traversal of this node's descendants, calling action for each one.
	 *
	 * @param action - Action to be called for each child.
	 * @param includeSelf - Whether to call action on this node as well. Defaults to
	 *   false.
	 * @param childrenFirst - Whether to call action on children before calling it on
	 *   parent.
	 */
	function treeForEachDescendant(tree, action, includeSelf, childrenFirst) {
	    if (includeSelf && !childrenFirst) {
	        action(tree);
	    }
	    treeForEachChild(tree, child => {
	        treeForEachDescendant(child, action, true, childrenFirst);
	    });
	    if (includeSelf && childrenFirst) {
	        action(tree);
	    }
	}
	/**
	 * Calls action on each ancestor node.
	 *
	 * @param action - Action to be called on each parent; return
	 *   true to abort.
	 * @param includeSelf - Whether to call action on this node as well.
	 * @returns true if the action callback returned true.
	 */
	function treeForEachAncestor(tree, action, includeSelf) {
	    let node = includeSelf ? tree : tree.parent;
	    while (node !== null) {
	        if (action(node)) {
	            return true;
	        }
	        node = node.parent;
	    }
	    return false;
	}
	/**
	 * @returns The path of this tree node, as a Path.
	 */
	function treeGetPath(tree) {
	    return new Path(tree.parent === null
	        ? tree.name
	        : treeGetPath(tree.parent) + '/' + tree.name);
	}
	/**
	 * Adds or removes this child from its parent based on whether it's empty or not.
	 */
	function treeUpdateParents(tree) {
	    if (tree.parent !== null) {
	        treeUpdateChild(tree.parent, tree.name, tree);
	    }
	}
	/**
	 * Adds or removes the passed child to this tree node, depending on whether it's empty.
	 *
	 * @param childName - The name of the child to update.
	 * @param child - The child to update.
	 */
	function treeUpdateChild(tree, childName, child) {
	    const childEmpty = treeIsEmpty(child);
	    const childExists = contains(tree.node.children, childName);
	    if (childEmpty && childExists) {
	        delete tree.node.children[childName];
	        tree.node.childCount--;
	        treeUpdateParents(tree);
	    }
	    else if (!childEmpty && !childExists) {
	        tree.node.children[childName] = child.node;
	        tree.node.childCount++;
	        treeUpdateParents(tree);
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * True for invalid Firebase keys
	 */
	const INVALID_KEY_REGEX_ = /[\[\].#$\/\u0000-\u001F\u007F]/;
	/**
	 * True for invalid Firebase paths.
	 * Allows '/' in paths.
	 */
	const INVALID_PATH_REGEX_ = /[\[\].#$\u0000-\u001F\u007F]/;
	/**
	 * Maximum number of characters to allow in leaf value
	 */
	const MAX_LEAF_SIZE_ = 10 * 1024 * 1024;
	const isValidKey = function (key) {
	    return (typeof key === 'string' && key.length !== 0 && !INVALID_KEY_REGEX_.test(key));
	};
	const isValidPathString = function (pathString) {
	    return (typeof pathString === 'string' &&
	        pathString.length !== 0 &&
	        !INVALID_PATH_REGEX_.test(pathString));
	};
	const isValidRootPathString = function (pathString) {
	    if (pathString) {
	        // Allow '/.info/' at the beginning.
	        pathString = pathString.replace(/^\/*\.info(\/|$)/, '/');
	    }
	    return isValidPathString(pathString);
	};
	/**
	 * Pre-validate a datum passed as an argument to Firebase function.
	 */
	const validateFirebaseDataArg = function (fnName, value, path, optional) {
	    if (optional && value === undefined) {
	        return;
	    }
	    validateFirebaseData(errorPrefix(fnName, 'value'), value, path);
	};
	/**
	 * Validate a data object client-side before sending to server.
	 */
	const validateFirebaseData = function (errorPrefix, data, path_) {
	    const path = path_ instanceof Path ? new ValidationPath(path_, errorPrefix) : path_;
	    if (data === undefined) {
	        throw new Error(errorPrefix + 'contains undefined ' + validationPathToErrorString(path));
	    }
	    if (typeof data === 'function') {
	        throw new Error(errorPrefix +
	            'contains a function ' +
	            validationPathToErrorString(path) +
	            ' with contents = ' +
	            data.toString());
	    }
	    if (isInvalidJSONNumber(data)) {
	        throw new Error(errorPrefix +
	            'contains ' +
	            data.toString() +
	            ' ' +
	            validationPathToErrorString(path));
	    }
	    // Check max leaf size, but try to avoid the utf8 conversion if we can.
	    if (typeof data === 'string' &&
	        data.length > MAX_LEAF_SIZE_ / 3 &&
	        stringLength(data) > MAX_LEAF_SIZE_) {
	        throw new Error(errorPrefix +
	            'contains a string greater than ' +
	            MAX_LEAF_SIZE_ +
	            ' utf8 bytes ' +
	            validationPathToErrorString(path) +
	            " ('" +
	            data.substring(0, 50) +
	            "...')");
	    }
	    // TODO = Perf = Consider combining the recursive validation of keys into NodeFromJSON
	    // to save extra walking of large objects.
	    if (data && typeof data === 'object') {
	        let hasDotValue = false;
	        let hasActualChild = false;
	        each(data, (key, value) => {
	            if (key === '.value') {
	                hasDotValue = true;
	            }
	            else if (key !== '.priority' && key !== '.sv') {
	                hasActualChild = true;
	                if (!isValidKey(key)) {
	                    throw new Error(errorPrefix +
	                        ' contains an invalid key (' +
	                        key +
	                        ') ' +
	                        validationPathToErrorString(path) +
	                        '.  Keys must be non-empty strings ' +
	                        'and can\'t contain ".", "#", "$", "/", "[", or "]"');
	                }
	            }
	            validationPathPush(path, key);
	            validateFirebaseData(errorPrefix, value, path);
	            validationPathPop(path);
	        });
	        if (hasDotValue && hasActualChild) {
	            throw new Error(errorPrefix +
	                ' contains ".value" child ' +
	                validationPathToErrorString(path) +
	                ' in addition to actual children.');
	        }
	    }
	};
	/**
	 * @internal
	 */
	const validatePathString = function (fnName, argumentName, pathString, optional) {
	    if (optional && pathString === undefined) {
	        return;
	    }
	    if (!isValidPathString(pathString)) {
	        throw new Error(errorPrefix(fnName, argumentName) +
	            'was an invalid path = "' +
	            pathString +
	            '". Paths must be non-empty strings and ' +
	            'can\'t contain ".", "#", "$", "[", or "]"');
	    }
	};
	const validateRootPathString = function (fnName, argumentName, pathString, optional) {
	    if (pathString) {
	        // Allow '/.info/' at the beginning.
	        pathString = pathString.replace(/^\/*\.info(\/|$)/, '/');
	    }
	    validatePathString(fnName, argumentName, pathString, optional);
	};
	/**
	 * @internal
	 */
	const validateWritablePath = function (fnName, path) {
	    if (pathGetFront(path) === '.info') {
	        throw new Error(fnName + " failed = Can't modify data under /.info/");
	    }
	};
	const validateUrl = function (fnName, parsedUrl) {
	    // TODO = Validate server better.
	    const pathString = parsedUrl.path.toString();
	    if (!(typeof parsedUrl.repoInfo.host === 'string') ||
	        parsedUrl.repoInfo.host.length === 0 ||
	        (!isValidKey(parsedUrl.repoInfo.namespace) &&
	            parsedUrl.repoInfo.host.split(':')[0] !== 'localhost') ||
	        (pathString.length !== 0 && !isValidRootPathString(pathString))) {
	        throw new Error(errorPrefix(fnName, 'url') +
	            'must be a valid firebase URL and ' +
	            'the path can\'t contain ".", "#", "$", "[", or "]".');
	    }
	};

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * The event queue serves a few purposes:
	 * 1. It ensures we maintain event order in the face of event callbacks doing operations that result in more
	 *    events being queued.
	 * 2. raiseQueuedEvents() handles being called reentrantly nicely.  That is, if in the course of raising events,
	 *    raiseQueuedEvents() is called again, the "inner" call will pick up raising events where the "outer" call
	 *    left off, ensuring that the events are still raised synchronously and in order.
	 * 3. You can use raiseEventsAtPath and raiseEventsForChangedPath to ensure only relevant previously-queued
	 *    events are raised synchronously.
	 *
	 * NOTE: This can all go away if/when we move to async events.
	 *
	 */
	class EventQueue {
	    constructor() {
	        this.eventLists_ = [];
	        /**
	         * Tracks recursion depth of raiseQueuedEvents_, for debugging purposes.
	         */
	        this.recursionDepth_ = 0;
	    }
	}
	/**
	 * @param eventDataList - The new events to queue.
	 */
	function eventQueueQueueEvents(eventQueue, eventDataList) {
	    // We group events by path, storing them in a single EventList, to make it easier to skip over them quickly.
	    let currList = null;
	    for (let i = 0; i < eventDataList.length; i++) {
	        const data = eventDataList[i];
	        const path = data.getPath();
	        if (currList !== null && !pathEquals(path, currList.path)) {
	            eventQueue.eventLists_.push(currList);
	            currList = null;
	        }
	        if (currList === null) {
	            currList = { events: [], path };
	        }
	        currList.events.push(data);
	    }
	    if (currList) {
	        eventQueue.eventLists_.push(currList);
	    }
	}
	/**
	 * Queues the specified events and synchronously raises all events (including previously queued ones)
	 * for the specified path.
	 *
	 * It is assumed that the new events are all for the specified path.
	 *
	 * @param path - The path to raise events for.
	 * @param eventDataList - The new events to raise.
	 */
	function eventQueueRaiseEventsAtPath(eventQueue, path, eventDataList) {
	    eventQueueQueueEvents(eventQueue, eventDataList);
	    eventQueueRaiseQueuedEventsMatchingPredicate(eventQueue, eventPath => pathEquals(eventPath, path));
	}
	/**
	 * Queues the specified events and synchronously raises all events (including previously queued ones) for
	 * locations related to the specified change path (i.e. all ancestors and descendants).
	 *
	 * It is assumed that the new events are all related (ancestor or descendant) to the specified path.
	 *
	 * @param changedPath - The path to raise events for.
	 * @param eventDataList - The events to raise
	 */
	function eventQueueRaiseEventsForChangedPath(eventQueue, changedPath, eventDataList) {
	    eventQueueQueueEvents(eventQueue, eventDataList);
	    eventQueueRaiseQueuedEventsMatchingPredicate(eventQueue, eventPath => pathContains(eventPath, changedPath) ||
	        pathContains(changedPath, eventPath));
	}
	function eventQueueRaiseQueuedEventsMatchingPredicate(eventQueue, predicate) {
	    eventQueue.recursionDepth_++;
	    let sentAll = true;
	    for (let i = 0; i < eventQueue.eventLists_.length; i++) {
	        const eventList = eventQueue.eventLists_[i];
	        if (eventList) {
	            const eventPath = eventList.path;
	            if (predicate(eventPath)) {
	                eventListRaise(eventQueue.eventLists_[i]);
	                eventQueue.eventLists_[i] = null;
	            }
	            else {
	                sentAll = false;
	            }
	        }
	    }
	    if (sentAll) {
	        eventQueue.eventLists_ = [];
	    }
	    eventQueue.recursionDepth_--;
	}
	/**
	 * Iterates through the list and raises each event
	 */
	function eventListRaise(eventList) {
	    for (let i = 0; i < eventList.events.length; i++) {
	        const eventData = eventList.events[i];
	        if (eventData !== null) {
	            eventList.events[i] = null;
	            const eventFn = eventData.getEventRunner();
	            if (logger) {
	                log('event: ' + eventData.toString());
	            }
	            exceptionGuard(eventFn);
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const INTERRUPT_REASON = 'repo_interrupt';
	/**
	 * If a transaction does not succeed after 25 retries, we abort it. Among other
	 * things this ensure that if there's ever a bug causing a mismatch between
	 * client / server hashes for some data, we won't retry indefinitely.
	 */
	const MAX_TRANSACTION_RETRIES = 25;
	/**
	 * A connection to a single data repository.
	 */
	class Repo {
	    constructor(repoInfo_, forceRestClient_, authTokenProvider_, appCheckProvider_) {
	        this.repoInfo_ = repoInfo_;
	        this.forceRestClient_ = forceRestClient_;
	        this.authTokenProvider_ = authTokenProvider_;
	        this.appCheckProvider_ = appCheckProvider_;
	        this.dataUpdateCount = 0;
	        this.statsListener_ = null;
	        this.eventQueue_ = new EventQueue();
	        this.nextWriteId_ = 1;
	        this.interceptServerDataCallback_ = null;
	        /** A list of data pieces and paths to be set when this client disconnects. */
	        this.onDisconnect_ = newSparseSnapshotTree();
	        /** Stores queues of outstanding transactions for Firebase locations. */
	        this.transactionQueueTree_ = new Tree();
	        // TODO: This should be @private but it's used by test_access.js and internal.js
	        this.persistentConnection_ = null;
	        // This key is intentionally not updated if RepoInfo is later changed or replaced
	        this.key = this.repoInfo_.toURLString();
	    }
	    /**
	     * @returns The URL corresponding to the root of this Firebase.
	     */
	    toString() {
	        return ((this.repoInfo_.secure ? 'https://' : 'http://') + this.repoInfo_.host);
	    }
	}
	function repoStart(repo, appId, authOverride) {
	    repo.stats_ = statsManagerGetCollection(repo.repoInfo_);
	    if (repo.forceRestClient_ || beingCrawled()) {
	        repo.server_ = new ReadonlyRestClient(repo.repoInfo_, (pathString, data, isMerge, tag) => {
	            repoOnDataUpdate(repo, pathString, data, isMerge, tag);
	        }, repo.authTokenProvider_, repo.appCheckProvider_);
	        // Minor hack: Fire onConnect immediately, since there's no actual connection.
	        setTimeout(() => repoOnConnectStatus(repo, /* connectStatus= */ true), 0);
	    }
	    else {
	        // Validate authOverride
	        if (typeof authOverride !== 'undefined' && authOverride !== null) {
	            if (typeof authOverride !== 'object') {
	                throw new Error('Only objects are supported for option databaseAuthVariableOverride');
	            }
	            try {
	                stringify(authOverride);
	            }
	            catch (e) {
	                throw new Error('Invalid authOverride provided: ' + e);
	            }
	        }
	        repo.persistentConnection_ = new PersistentConnection(repo.repoInfo_, appId, (pathString, data, isMerge, tag) => {
	            repoOnDataUpdate(repo, pathString, data, isMerge, tag);
	        }, (connectStatus) => {
	            repoOnConnectStatus(repo, connectStatus);
	        }, (updates) => {
	            repoOnServerInfoUpdate(repo, updates);
	        }, repo.authTokenProvider_, repo.appCheckProvider_, authOverride);
	        repo.server_ = repo.persistentConnection_;
	    }
	    repo.authTokenProvider_.addTokenChangeListener(token => {
	        repo.server_.refreshAuthToken(token);
	    });
	    repo.appCheckProvider_.addTokenChangeListener(result => {
	        repo.server_.refreshAppCheckToken(result.token);
	    });
	    // In the case of multiple Repos for the same repoInfo (i.e. there are multiple Firebase.Contexts being used),
	    // we only want to create one StatsReporter.  As such, we'll report stats over the first Repo created.
	    repo.statsReporter_ = statsManagerGetOrCreateReporter(repo.repoInfo_, () => new StatsReporter(repo.stats_, repo.server_));
	    // Used for .info.
	    repo.infoData_ = new SnapshotHolder();
	    repo.infoSyncTree_ = new SyncTree({
	        startListening: (query, tag, currentHashFn, onComplete) => {
	            let infoEvents = [];
	            const node = repo.infoData_.getNode(query._path);
	            // This is possibly a hack, but we have different semantics for .info endpoints. We don't raise null events
	            // on initial data...
	            if (!node.isEmpty()) {
	                infoEvents = syncTreeApplyServerOverwrite(repo.infoSyncTree_, query._path, node);
	                setTimeout(() => {
	                    onComplete('ok');
	                }, 0);
	            }
	            return infoEvents;
	        },
	        stopListening: () => { }
	    });
	    repoUpdateInfo(repo, 'connected', false);
	    repo.serverSyncTree_ = new SyncTree({
	        startListening: (query, tag, currentHashFn, onComplete) => {
	            repo.server_.listen(query, currentHashFn, tag, (status, data) => {
	                const events = onComplete(status, data);
	                eventQueueRaiseEventsForChangedPath(repo.eventQueue_, query._path, events);
	            });
	            // No synchronous events for network-backed sync trees
	            return [];
	        },
	        stopListening: (query, tag) => {
	            repo.server_.unlisten(query, tag);
	        }
	    });
	}
	/**
	 * @returns The time in milliseconds, taking the server offset into account if we have one.
	 */
	function repoServerTime(repo) {
	    const offsetNode = repo.infoData_.getNode(new Path('.info/serverTimeOffset'));
	    const offset = offsetNode.val() || 0;
	    return new Date().getTime() + offset;
	}
	/**
	 * Generate ServerValues using some variables from the repo object.
	 */
	function repoGenerateServerValues(repo) {
	    return generateWithValues({
	        timestamp: repoServerTime(repo)
	    });
	}
	/**
	 * Called by realtime when we get new messages from the server.
	 */
	function repoOnDataUpdate(repo, pathString, data, isMerge, tag) {
	    // For testing.
	    repo.dataUpdateCount++;
	    const path = new Path(pathString);
	    data = repo.interceptServerDataCallback_
	        ? repo.interceptServerDataCallback_(pathString, data)
	        : data;
	    let events = [];
	    if (tag) {
	        if (isMerge) {
	            const taggedChildren = map(data, (raw) => nodeFromJSON(raw));
	            events = syncTreeApplyTaggedQueryMerge(repo.serverSyncTree_, path, taggedChildren, tag);
	        }
	        else {
	            const taggedSnap = nodeFromJSON(data);
	            events = syncTreeApplyTaggedQueryOverwrite(repo.serverSyncTree_, path, taggedSnap, tag);
	        }
	    }
	    else if (isMerge) {
	        const changedChildren = map(data, (raw) => nodeFromJSON(raw));
	        events = syncTreeApplyServerMerge(repo.serverSyncTree_, path, changedChildren);
	    }
	    else {
	        const snap = nodeFromJSON(data);
	        events = syncTreeApplyServerOverwrite(repo.serverSyncTree_, path, snap);
	    }
	    let affectedPath = path;
	    if (events.length > 0) {
	        // Since we have a listener outstanding for each transaction, receiving any events
	        // is a proxy for some change having occurred.
	        affectedPath = repoRerunTransactions(repo, path);
	    }
	    eventQueueRaiseEventsForChangedPath(repo.eventQueue_, affectedPath, events);
	}
	function repoOnConnectStatus(repo, connectStatus) {
	    repoUpdateInfo(repo, 'connected', connectStatus);
	    if (connectStatus === false) {
	        repoRunOnDisconnectEvents(repo);
	    }
	}
	function repoOnServerInfoUpdate(repo, updates) {
	    each(updates, (key, value) => {
	        repoUpdateInfo(repo, key, value);
	    });
	}
	function repoUpdateInfo(repo, pathString, value) {
	    const path = new Path('/.info/' + pathString);
	    const newNode = nodeFromJSON(value);
	    repo.infoData_.updateSnapshot(path, newNode);
	    const events = syncTreeApplyServerOverwrite(repo.infoSyncTree_, path, newNode);
	    eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, events);
	}
	function repoGetNextWriteId(repo) {
	    return repo.nextWriteId_++;
	}
	/**
	 * The purpose of `getValue` is to return the latest known value
	 * satisfying `query`.
	 *
	 * This method will first check for in-memory cached values
	 * belonging to active listeners. If they are found, such values
	 * are considered to be the most up-to-date.
	 *
	 * If the client is not connected, this method will wait until the
	 *  repo has established a connection and then request the value for `query`.
	 * If the client is not able to retrieve the query result for another reason,
	 * it reports an error.
	 *
	 * @param query - The query to surface a value for.
	 */
	function repoGetValue(repo, query, eventRegistration) {
	    // Only active queries are cached. There is no persisted cache.
	    const cached = syncTreeGetServerValue(repo.serverSyncTree_, query);
	    if (cached != null) {
	        return Promise.resolve(cached);
	    }
	    return repo.server_.get(query).then(payload => {
	        const node = nodeFromJSON(payload).withIndex(query._queryParams.getIndex());
	        /**
	         * Below we simulate the actions of an `onlyOnce` `onValue()` event where:
	         * Add an event registration,
	         * Update data at the path,
	         * Raise any events,
	         * Cleanup the SyncTree
	         */
	        syncTreeAddEventRegistration(repo.serverSyncTree_, query, eventRegistration, true);
	        let events;
	        if (query._queryParams.loadsAllData()) {
	            events = syncTreeApplyServerOverwrite(repo.serverSyncTree_, query._path, node);
	        }
	        else {
	            const tag = syncTreeTagForQuery(repo.serverSyncTree_, query);
	            events = syncTreeApplyTaggedQueryOverwrite(repo.serverSyncTree_, query._path, node, tag);
	        }
	        /*
	         * We need to raise events in the scenario where `get()` is called at a parent path, and
	         * while the `get()` is pending, `onValue` is called at a child location. While get() is waiting
	         * for the data, `onValue` will register a new event. Then, get() will come back, and update the syncTree
	         * and its corresponding serverCache, including the child location where `onValue` is called. Then,
	         * `onValue` will receive the event from the server, but look at the syncTree and see that the data received
	         * from the server is already at the SyncPoint, and so the `onValue` callback will never get fired.
	         * Calling `eventQueueRaiseEventsForChangedPath()` is the correct way to propagate the events and
	         * ensure the corresponding child events will get fired.
	         */
	        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, query._path, events);
	        syncTreeRemoveEventRegistration(repo.serverSyncTree_, query, eventRegistration, null, true);
	        return node;
	    }, err => {
	        repoLog(repo, 'get for query ' + stringify(query) + ' failed: ' + err);
	        return Promise.reject(new Error(err));
	    });
	}
	function repoSetWithPriority(repo, path, newVal, newPriority, onComplete) {
	    repoLog(repo, 'set', {
	        path: path.toString(),
	        value: newVal,
	        priority: newPriority
	    });
	    // TODO: Optimize this behavior to either (a) store flag to skip resolving where possible and / or
	    // (b) store unresolved paths on JSON parse
	    const serverValues = repoGenerateServerValues(repo);
	    const newNodeUnresolved = nodeFromJSON(newVal, newPriority);
	    const existing = syncTreeCalcCompleteEventCache(repo.serverSyncTree_, path);
	    const newNode = resolveDeferredValueSnapshot(newNodeUnresolved, existing, serverValues);
	    const writeId = repoGetNextWriteId(repo);
	    const events = syncTreeApplyUserOverwrite(repo.serverSyncTree_, path, newNode, writeId, true);
	    eventQueueQueueEvents(repo.eventQueue_, events);
	    repo.server_.put(path.toString(), newNodeUnresolved.val(/*export=*/ true), (status, errorReason) => {
	        const success = status === 'ok';
	        if (!success) {
	            warn('set at ' + path + ' failed: ' + status);
	        }
	        const clearEvents = syncTreeAckUserWrite(repo.serverSyncTree_, writeId, !success);
	        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, clearEvents);
	        repoCallOnCompleteCallback(repo, onComplete, status, errorReason);
	    });
	    const affectedPath = repoAbortTransactions(repo, path);
	    repoRerunTransactions(repo, affectedPath);
	    // We queued the events above, so just flush the queue here
	    eventQueueRaiseEventsForChangedPath(repo.eventQueue_, affectedPath, []);
	}
	/**
	 * Applies all of the changes stored up in the onDisconnect_ tree.
	 */
	function repoRunOnDisconnectEvents(repo) {
	    repoLog(repo, 'onDisconnectEvents');
	    const serverValues = repoGenerateServerValues(repo);
	    const resolvedOnDisconnectTree = newSparseSnapshotTree();
	    sparseSnapshotTreeForEachTree(repo.onDisconnect_, newEmptyPath(), (path, node) => {
	        const resolved = resolveDeferredValueTree(path, node, repo.serverSyncTree_, serverValues);
	        sparseSnapshotTreeRemember(resolvedOnDisconnectTree, path, resolved);
	    });
	    let events = [];
	    sparseSnapshotTreeForEachTree(resolvedOnDisconnectTree, newEmptyPath(), (path, snap) => {
	        events = events.concat(syncTreeApplyServerOverwrite(repo.serverSyncTree_, path, snap));
	        const affectedPath = repoAbortTransactions(repo, path);
	        repoRerunTransactions(repo, affectedPath);
	    });
	    repo.onDisconnect_ = newSparseSnapshotTree();
	    eventQueueRaiseEventsForChangedPath(repo.eventQueue_, newEmptyPath(), events);
	}
	function repoAddEventCallbackForQuery(repo, query, eventRegistration) {
	    let events;
	    if (pathGetFront(query._path) === '.info') {
	        events = syncTreeAddEventRegistration(repo.infoSyncTree_, query, eventRegistration);
	    }
	    else {
	        events = syncTreeAddEventRegistration(repo.serverSyncTree_, query, eventRegistration);
	    }
	    eventQueueRaiseEventsAtPath(repo.eventQueue_, query._path, events);
	}
	function repoRemoveEventCallbackForQuery(repo, query, eventRegistration) {
	    // These are guaranteed not to raise events, since we're not passing in a cancelError. However, we can future-proof
	    // a little bit by handling the return values anyways.
	    let events;
	    if (pathGetFront(query._path) === '.info') {
	        events = syncTreeRemoveEventRegistration(repo.infoSyncTree_, query, eventRegistration);
	    }
	    else {
	        events = syncTreeRemoveEventRegistration(repo.serverSyncTree_, query, eventRegistration);
	    }
	    eventQueueRaiseEventsAtPath(repo.eventQueue_, query._path, events);
	}
	function repoInterrupt(repo) {
	    if (repo.persistentConnection_) {
	        repo.persistentConnection_.interrupt(INTERRUPT_REASON);
	    }
	}
	function repoLog(repo, ...varArgs) {
	    let prefix = '';
	    if (repo.persistentConnection_) {
	        prefix = repo.persistentConnection_.id + ':';
	    }
	    log(prefix, ...varArgs);
	}
	function repoCallOnCompleteCallback(repo, callback, status, errorReason) {
	    if (callback) {
	        exceptionGuard(() => {
	            if (status === 'ok') {
	                callback(null);
	            }
	            else {
	                const code = (status || 'error').toUpperCase();
	                let message = code;
	                if (errorReason) {
	                    message += ': ' + errorReason;
	                }
	                const error = new Error(message);
	                // eslint-disable-next-line @typescript-eslint/no-explicit-any
	                error.code = code;
	                callback(error);
	            }
	        });
	    }
	}
	/**
	 * @param excludeSets - A specific set to exclude
	 */
	function repoGetLatestState(repo, path, excludeSets) {
	    return (syncTreeCalcCompleteEventCache(repo.serverSyncTree_, path, excludeSets) ||
	        ChildrenNode.EMPTY_NODE);
	}
	/**
	 * Sends any already-run transactions that aren't waiting for outstanding
	 * transactions to complete.
	 *
	 * Externally it's called with no arguments, but it calls itself recursively
	 * with a particular transactionQueueTree node to recurse through the tree.
	 *
	 * @param node - transactionQueueTree node to start at.
	 */
	function repoSendReadyTransactions(repo, node = repo.transactionQueueTree_) {
	    // Before recursing, make sure any completed transactions are removed.
	    if (!node) {
	        repoPruneCompletedTransactionsBelowNode(repo, node);
	    }
	    if (treeGetValue(node)) {
	        const queue = repoBuildTransactionQueue(repo, node);
	        assert(queue.length > 0, 'Sending zero length transaction queue');
	        const allRun = queue.every((transaction) => transaction.status === 0 /* TransactionStatus.RUN */);
	        // If they're all run (and not sent), we can send them.  Else, we must wait.
	        if (allRun) {
	            repoSendTransactionQueue(repo, treeGetPath(node), queue);
	        }
	    }
	    else if (treeHasChildren(node)) {
	        treeForEachChild(node, childNode => {
	            repoSendReadyTransactions(repo, childNode);
	        });
	    }
	}
	/**
	 * Given a list of run transactions, send them to the server and then handle
	 * the result (success or failure).
	 *
	 * @param path - The location of the queue.
	 * @param queue - Queue of transactions under the specified location.
	 */
	function repoSendTransactionQueue(repo, path, queue) {
	    // Mark transactions as sent and increment retry count!
	    const setsToIgnore = queue.map(txn => {
	        return txn.currentWriteId;
	    });
	    const latestState = repoGetLatestState(repo, path, setsToIgnore);
	    let snapToSend = latestState;
	    const latestHash = latestState.hash();
	    for (let i = 0; i < queue.length; i++) {
	        const txn = queue[i];
	        assert(txn.status === 0 /* TransactionStatus.RUN */, 'tryToSendTransactionQueue_: items in queue should all be run.');
	        txn.status = 1 /* TransactionStatus.SENT */;
	        txn.retryCount++;
	        const relativePath = newRelativePath(path, txn.path);
	        // If we've gotten to this point, the output snapshot must be defined.
	        snapToSend = snapToSend.updateChild(relativePath /** @type {!Node} */, txn.currentOutputSnapshotRaw);
	    }
	    const dataToSend = snapToSend.val(true);
	    const pathToSend = path;
	    // Send the put.
	    repo.server_.put(pathToSend.toString(), dataToSend, (status) => {
	        repoLog(repo, 'transaction put response', {
	            path: pathToSend.toString(),
	            status
	        });
	        let events = [];
	        if (status === 'ok') {
	            // Queue up the callbacks and fire them after cleaning up all of our
	            // transaction state, since the callback could trigger more
	            // transactions or sets.
	            const callbacks = [];
	            for (let i = 0; i < queue.length; i++) {
	                queue[i].status = 2 /* TransactionStatus.COMPLETED */;
	                events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, queue[i].currentWriteId));
	                if (queue[i].onComplete) {
	                    // We never unset the output snapshot, and given that this
	                    // transaction is complete, it should be set
	                    callbacks.push(() => queue[i].onComplete(null, true, queue[i].currentOutputSnapshotResolved));
	                }
	                queue[i].unwatcher();
	            }
	            // Now remove the completed transactions.
	            repoPruneCompletedTransactionsBelowNode(repo, treeSubTree(repo.transactionQueueTree_, path));
	            // There may be pending transactions that we can now send.
	            repoSendReadyTransactions(repo, repo.transactionQueueTree_);
	            eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, events);
	            // Finally, trigger onComplete callbacks.
	            for (let i = 0; i < callbacks.length; i++) {
	                exceptionGuard(callbacks[i]);
	            }
	        }
	        else {
	            // transactions are no longer sent.  Update their status appropriately.
	            if (status === 'datastale') {
	                for (let i = 0; i < queue.length; i++) {
	                    if (queue[i].status === 3 /* TransactionStatus.SENT_NEEDS_ABORT */) {
	                        queue[i].status = 4 /* TransactionStatus.NEEDS_ABORT */;
	                    }
	                    else {
	                        queue[i].status = 0 /* TransactionStatus.RUN */;
	                    }
	                }
	            }
	            else {
	                warn('transaction at ' + pathToSend.toString() + ' failed: ' + status);
	                for (let i = 0; i < queue.length; i++) {
	                    queue[i].status = 4 /* TransactionStatus.NEEDS_ABORT */;
	                    queue[i].abortReason = status;
	                }
	            }
	            repoRerunTransactions(repo, path);
	        }
	    }, latestHash);
	}
	/**
	 * Finds all transactions dependent on the data at changedPath and reruns them.
	 *
	 * Should be called any time cached data changes.
	 *
	 * Return the highest path that was affected by rerunning transactions. This
	 * is the path at which events need to be raised for.
	 *
	 * @param changedPath - The path in mergedData that changed.
	 * @returns The rootmost path that was affected by rerunning transactions.
	 */
	function repoRerunTransactions(repo, changedPath) {
	    const rootMostTransactionNode = repoGetAncestorTransactionNode(repo, changedPath);
	    const path = treeGetPath(rootMostTransactionNode);
	    const queue = repoBuildTransactionQueue(repo, rootMostTransactionNode);
	    repoRerunTransactionQueue(repo, queue, path);
	    return path;
	}
	/**
	 * Does all the work of rerunning transactions (as well as cleans up aborted
	 * transactions and whatnot).
	 *
	 * @param queue - The queue of transactions to run.
	 * @param path - The path the queue is for.
	 */
	function repoRerunTransactionQueue(repo, queue, path) {
	    if (queue.length === 0) {
	        return; // Nothing to do!
	    }
	    // Queue up the callbacks and fire them after cleaning up all of our
	    // transaction state, since the callback could trigger more transactions or
	    // sets.
	    const callbacks = [];
	    let events = [];
	    // Ignore all of the sets we're going to re-run.
	    const txnsToRerun = queue.filter(q => {
	        return q.status === 0 /* TransactionStatus.RUN */;
	    });
	    const setsToIgnore = txnsToRerun.map(q => {
	        return q.currentWriteId;
	    });
	    for (let i = 0; i < queue.length; i++) {
	        const transaction = queue[i];
	        const relativePath = newRelativePath(path, transaction.path);
	        let abortTransaction = false, abortReason;
	        assert(relativePath !== null, 'rerunTransactionsUnderNode_: relativePath should not be null.');
	        if (transaction.status === 4 /* TransactionStatus.NEEDS_ABORT */) {
	            abortTransaction = true;
	            abortReason = transaction.abortReason;
	            events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, transaction.currentWriteId, true));
	        }
	        else if (transaction.status === 0 /* TransactionStatus.RUN */) {
	            if (transaction.retryCount >= MAX_TRANSACTION_RETRIES) {
	                abortTransaction = true;
	                abortReason = 'maxretry';
	                events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, transaction.currentWriteId, true));
	            }
	            else {
	                // This code reruns a transaction
	                const currentNode = repoGetLatestState(repo, transaction.path, setsToIgnore);
	                transaction.currentInputSnapshot = currentNode;
	                const newData = queue[i].update(currentNode.val());
	                if (newData !== undefined) {
	                    validateFirebaseData('transaction failed: Data returned ', newData, transaction.path);
	                    let newDataNode = nodeFromJSON(newData);
	                    const hasExplicitPriority = typeof newData === 'object' &&
	                        newData != null &&
	                        contains(newData, '.priority');
	                    if (!hasExplicitPriority) {
	                        // Keep the old priority if there wasn't a priority explicitly specified.
	                        newDataNode = newDataNode.updatePriority(currentNode.getPriority());
	                    }
	                    const oldWriteId = transaction.currentWriteId;
	                    const serverValues = repoGenerateServerValues(repo);
	                    const newNodeResolved = resolveDeferredValueSnapshot(newDataNode, currentNode, serverValues);
	                    transaction.currentOutputSnapshotRaw = newDataNode;
	                    transaction.currentOutputSnapshotResolved = newNodeResolved;
	                    transaction.currentWriteId = repoGetNextWriteId(repo);
	                    // Mutates setsToIgnore in place
	                    setsToIgnore.splice(setsToIgnore.indexOf(oldWriteId), 1);
	                    events = events.concat(syncTreeApplyUserOverwrite(repo.serverSyncTree_, transaction.path, newNodeResolved, transaction.currentWriteId, transaction.applyLocally));
	                    events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, oldWriteId, true));
	                }
	                else {
	                    abortTransaction = true;
	                    abortReason = 'nodata';
	                    events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, transaction.currentWriteId, true));
	                }
	            }
	        }
	        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, events);
	        events = [];
	        if (abortTransaction) {
	            // Abort.
	            queue[i].status = 2 /* TransactionStatus.COMPLETED */;
	            // Removing a listener can trigger pruning which can muck with
	            // mergedData/visibleData (as it prunes data). So defer the unwatcher
	            // until we're done.
	            (function (unwatcher) {
	                setTimeout(unwatcher, Math.floor(0));
	            })(queue[i].unwatcher);
	            if (queue[i].onComplete) {
	                if (abortReason === 'nodata') {
	                    callbacks.push(() => queue[i].onComplete(null, false, queue[i].currentInputSnapshot));
	                }
	                else {
	                    callbacks.push(() => queue[i].onComplete(new Error(abortReason), false, null));
	                }
	            }
	        }
	    }
	    // Clean up completed transactions.
	    repoPruneCompletedTransactionsBelowNode(repo, repo.transactionQueueTree_);
	    // Now fire callbacks, now that we're in a good, known state.
	    for (let i = 0; i < callbacks.length; i++) {
	        exceptionGuard(callbacks[i]);
	    }
	    // Try to send the transaction result to the server.
	    repoSendReadyTransactions(repo, repo.transactionQueueTree_);
	}
	/**
	 * Returns the rootmost ancestor node of the specified path that has a pending
	 * transaction on it, or just returns the node for the given path if there are
	 * no pending transactions on any ancestor.
	 *
	 * @param path - The location to start at.
	 * @returns The rootmost node with a transaction.
	 */
	function repoGetAncestorTransactionNode(repo, path) {
	    let front;
	    // Start at the root and walk deeper into the tree towards path until we
	    // find a node with pending transactions.
	    let transactionNode = repo.transactionQueueTree_;
	    front = pathGetFront(path);
	    while (front !== null && treeGetValue(transactionNode) === undefined) {
	        transactionNode = treeSubTree(transactionNode, front);
	        path = pathPopFront(path);
	        front = pathGetFront(path);
	    }
	    return transactionNode;
	}
	/**
	 * Builds the queue of all transactions at or below the specified
	 * transactionNode.
	 *
	 * @param transactionNode
	 * @returns The generated queue.
	 */
	function repoBuildTransactionQueue(repo, transactionNode) {
	    // Walk any child transaction queues and aggregate them into a single queue.
	    const transactionQueue = [];
	    repoAggregateTransactionQueuesForNode(repo, transactionNode, transactionQueue);
	    // Sort them by the order the transactions were created.
	    transactionQueue.sort((a, b) => a.order - b.order);
	    return transactionQueue;
	}
	function repoAggregateTransactionQueuesForNode(repo, node, queue) {
	    const nodeQueue = treeGetValue(node);
	    if (nodeQueue) {
	        for (let i = 0; i < nodeQueue.length; i++) {
	            queue.push(nodeQueue[i]);
	        }
	    }
	    treeForEachChild(node, child => {
	        repoAggregateTransactionQueuesForNode(repo, child, queue);
	    });
	}
	/**
	 * Remove COMPLETED transactions at or below this node in the transactionQueueTree_.
	 */
	function repoPruneCompletedTransactionsBelowNode(repo, node) {
	    const queue = treeGetValue(node);
	    if (queue) {
	        let to = 0;
	        for (let from = 0; from < queue.length; from++) {
	            if (queue[from].status !== 2 /* TransactionStatus.COMPLETED */) {
	                queue[to] = queue[from];
	                to++;
	            }
	        }
	        queue.length = to;
	        treeSetValue(node, queue.length > 0 ? queue : undefined);
	    }
	    treeForEachChild(node, childNode => {
	        repoPruneCompletedTransactionsBelowNode(repo, childNode);
	    });
	}
	/**
	 * Aborts all transactions on ancestors or descendants of the specified path.
	 * Called when doing a set() or update() since we consider them incompatible
	 * with transactions.
	 *
	 * @param path - Path for which we want to abort related transactions.
	 */
	function repoAbortTransactions(repo, path) {
	    const affectedPath = treeGetPath(repoGetAncestorTransactionNode(repo, path));
	    const transactionNode = treeSubTree(repo.transactionQueueTree_, path);
	    treeForEachAncestor(transactionNode, (node) => {
	        repoAbortTransactionsOnNode(repo, node);
	    });
	    repoAbortTransactionsOnNode(repo, transactionNode);
	    treeForEachDescendant(transactionNode, (node) => {
	        repoAbortTransactionsOnNode(repo, node);
	    });
	    return affectedPath;
	}
	/**
	 * Abort transactions stored in this transaction queue node.
	 *
	 * @param node - Node to abort transactions for.
	 */
	function repoAbortTransactionsOnNode(repo, node) {
	    const queue = treeGetValue(node);
	    if (queue) {
	        // Queue up the callbacks and fire them after cleaning up all of our
	        // transaction state, since the callback could trigger more transactions
	        // or sets.
	        const callbacks = [];
	        // Go through queue.  Any already-sent transactions must be marked for
	        // abort, while the unsent ones can be immediately aborted and removed.
	        let events = [];
	        let lastSent = -1;
	        for (let i = 0; i < queue.length; i++) {
	            if (queue[i].status === 3 /* TransactionStatus.SENT_NEEDS_ABORT */) ;
	            else if (queue[i].status === 1 /* TransactionStatus.SENT */) {
	                assert(lastSent === i - 1, 'All SENT items should be at beginning of queue.');
	                lastSent = i;
	                // Mark transaction for abort when it comes back.
	                queue[i].status = 3 /* TransactionStatus.SENT_NEEDS_ABORT */;
	                queue[i].abortReason = 'set';
	            }
	            else {
	                assert(queue[i].status === 0 /* TransactionStatus.RUN */, 'Unexpected transaction status in abort');
	                // We can abort it immediately.
	                queue[i].unwatcher();
	                events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, queue[i].currentWriteId, true));
	                if (queue[i].onComplete) {
	                    callbacks.push(queue[i].onComplete.bind(null, new Error('set'), false, null));
	                }
	            }
	        }
	        if (lastSent === -1) {
	            // We're not waiting for any sent transactions.  We can clear the queue.
	            treeSetValue(node, undefined);
	        }
	        else {
	            // Remove the transactions we aborted.
	            queue.length = lastSent + 1;
	        }
	        // Now fire the callbacks.
	        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, treeGetPath(node), events);
	        for (let i = 0; i < callbacks.length; i++) {
	            exceptionGuard(callbacks[i]);
	        }
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function decodePath(pathString) {
	    let pathStringDecoded = '';
	    const pieces = pathString.split('/');
	    for (let i = 0; i < pieces.length; i++) {
	        if (pieces[i].length > 0) {
	            let piece = pieces[i];
	            try {
	                piece = decodeURIComponent(piece.replace(/\+/g, ' '));
	            }
	            catch (e) { }
	            pathStringDecoded += '/' + piece;
	        }
	    }
	    return pathStringDecoded;
	}
	/**
	 * @returns key value hash
	 */
	function decodeQuery(queryString) {
	    const results = {};
	    if (queryString.charAt(0) === '?') {
	        queryString = queryString.substring(1);
	    }
	    for (const segment of queryString.split('&')) {
	        if (segment.length === 0) {
	            continue;
	        }
	        const kv = segment.split('=');
	        if (kv.length === 2) {
	            results[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
	        }
	        else {
	            warn(`Invalid query segment '${segment}' in query '${queryString}'`);
	        }
	    }
	    return results;
	}
	const parseRepoInfo = function (dataURL, nodeAdmin) {
	    const parsedUrl = parseDatabaseURL(dataURL), namespace = parsedUrl.namespace;
	    if (parsedUrl.domain === 'firebase.com') {
	        fatal(parsedUrl.host +
	            ' is no longer supported. ' +
	            'Please use <YOUR FIREBASE>.firebaseio.com instead');
	    }
	    // Catch common error of uninitialized namespace value.
	    if ((!namespace || namespace === 'undefined') &&
	        parsedUrl.domain !== 'localhost') {
	        fatal('Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com');
	    }
	    if (!parsedUrl.secure) {
	        warnIfPageIsSecure();
	    }
	    const webSocketOnly = parsedUrl.scheme === 'ws' || parsedUrl.scheme === 'wss';
	    return {
	        repoInfo: new RepoInfo(parsedUrl.host, parsedUrl.secure, namespace, webSocketOnly, nodeAdmin, 
	        /*persistenceKey=*/ '', 
	        /*includeNamespaceInQueryParams=*/ namespace !== parsedUrl.subdomain),
	        path: new Path(parsedUrl.pathString)
	    };
	};
	const parseDatabaseURL = function (dataURL) {
	    // Default to empty strings in the event of a malformed string.
	    let host = '', domain = '', subdomain = '', pathString = '', namespace = '';
	    // Always default to SSL, unless otherwise specified.
	    let secure = true, scheme = 'https', port = 443;
	    // Don't do any validation here. The caller is responsible for validating the result of parsing.
	    if (typeof dataURL === 'string') {
	        // Parse scheme.
	        let colonInd = dataURL.indexOf('//');
	        if (colonInd >= 0) {
	            scheme = dataURL.substring(0, colonInd - 1);
	            dataURL = dataURL.substring(colonInd + 2);
	        }
	        // Parse host, path, and query string.
	        let slashInd = dataURL.indexOf('/');
	        if (slashInd === -1) {
	            slashInd = dataURL.length;
	        }
	        let questionMarkInd = dataURL.indexOf('?');
	        if (questionMarkInd === -1) {
	            questionMarkInd = dataURL.length;
	        }
	        host = dataURL.substring(0, Math.min(slashInd, questionMarkInd));
	        if (slashInd < questionMarkInd) {
	            // For pathString, questionMarkInd will always come after slashInd
	            pathString = decodePath(dataURL.substring(slashInd, questionMarkInd));
	        }
	        const queryParams = decodeQuery(dataURL.substring(Math.min(dataURL.length, questionMarkInd)));
	        // If we have a port, use scheme for determining if it's secure.
	        colonInd = host.indexOf(':');
	        if (colonInd >= 0) {
	            secure = scheme === 'https' || scheme === 'wss';
	            port = parseInt(host.substring(colonInd + 1), 10);
	        }
	        else {
	            colonInd = host.length;
	        }
	        const hostWithoutPort = host.slice(0, colonInd);
	        if (hostWithoutPort.toLowerCase() === 'localhost') {
	            domain = 'localhost';
	        }
	        else if (hostWithoutPort.split('.').length <= 2) {
	            domain = hostWithoutPort;
	        }
	        else {
	            // Interpret the subdomain of a 3 or more component URL as the namespace name.
	            const dotInd = host.indexOf('.');
	            subdomain = host.substring(0, dotInd).toLowerCase();
	            domain = host.substring(dotInd + 1);
	            // Normalize namespaces to lowercase to share storage / connection.
	            namespace = subdomain;
	        }
	        // Always treat the value of the `ns` as the namespace name if it is present.
	        if ('ns' in queryParams) {
	            namespace = queryParams['ns'];
	        }
	    }
	    return {
	        host,
	        port,
	        domain,
	        subdomain,
	        secure,
	        scheme,
	        pathString,
	        namespace
	    };
	};

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * Encapsulates the data needed to raise an event
	 */
	class DataEvent {
	    /**
	     * @param eventType - One of: value, child_added, child_changed, child_moved, child_removed
	     * @param eventRegistration - The function to call to with the event data. User provided
	     * @param snapshot - The data backing the event
	     * @param prevName - Optional, the name of the previous child for child_* events.
	     */
	    constructor(eventType, eventRegistration, snapshot, prevName) {
	        this.eventType = eventType;
	        this.eventRegistration = eventRegistration;
	        this.snapshot = snapshot;
	        this.prevName = prevName;
	    }
	    getPath() {
	        const ref = this.snapshot.ref;
	        if (this.eventType === 'value') {
	            return ref._path;
	        }
	        else {
	            return ref.parent._path;
	        }
	    }
	    getEventType() {
	        return this.eventType;
	    }
	    getEventRunner() {
	        return this.eventRegistration.getEventRunner(this);
	    }
	    toString() {
	        return (this.getPath().toString() +
	            ':' +
	            this.eventType +
	            ':' +
	            stringify(this.snapshot.exportVal()));
	    }
	}
	class CancelEvent {
	    constructor(eventRegistration, error, path) {
	        this.eventRegistration = eventRegistration;
	        this.error = error;
	        this.path = path;
	    }
	    getPath() {
	        return this.path;
	    }
	    getEventType() {
	        return 'cancel';
	    }
	    getEventRunner() {
	        return this.eventRegistration.getEventRunner(this);
	    }
	    toString() {
	        return this.path.toString() + ':cancel';
	    }
	}

	/**
	 * @license
	 * Copyright 2017 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * A wrapper class that converts events from the database@exp SDK to the legacy
	 * Database SDK. Events are not converted directly as event registration relies
	 * on reference comparison of the original user callback (see `matches()`) and
	 * relies on equality of the legacy SDK's `context` object.
	 */
	class CallbackContext {
	    constructor(snapshotCallback, cancelCallback) {
	        this.snapshotCallback = snapshotCallback;
	        this.cancelCallback = cancelCallback;
	    }
	    onValue(expDataSnapshot, previousChildName) {
	        this.snapshotCallback.call(null, expDataSnapshot, previousChildName);
	    }
	    onCancel(error) {
	        assert(this.hasCancelCallback, 'Raising a cancel event on a listener with no cancel callback');
	        return this.cancelCallback.call(null, error);
	    }
	    get hasCancelCallback() {
	        return !!this.cancelCallback;
	    }
	    matches(other) {
	        return (this.snapshotCallback === other.snapshotCallback ||
	            (this.snapshotCallback.userCallback !== undefined &&
	                this.snapshotCallback.userCallback ===
	                    other.snapshotCallback.userCallback &&
	                this.snapshotCallback.context === other.snapshotCallback.context));
	    }
	}

	/**
	 * @license
	 * Copyright 2020 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * @internal
	 */
	class QueryImpl {
	    /**
	     * @hideconstructor
	     */
	    constructor(_repo, _path, _queryParams, _orderByCalled) {
	        this._repo = _repo;
	        this._path = _path;
	        this._queryParams = _queryParams;
	        this._orderByCalled = _orderByCalled;
	    }
	    get key() {
	        if (pathIsEmpty(this._path)) {
	            return null;
	        }
	        else {
	            return pathGetBack(this._path);
	        }
	    }
	    get ref() {
	        return new ReferenceImpl(this._repo, this._path);
	    }
	    get _queryIdentifier() {
	        const obj = queryParamsGetQueryObject(this._queryParams);
	        const id = ObjectToUniqueKey(obj);
	        return id === '{}' ? 'default' : id;
	    }
	    /**
	     * An object representation of the query parameters used by this Query.
	     */
	    get _queryObject() {
	        return queryParamsGetQueryObject(this._queryParams);
	    }
	    isEqual(other) {
	        other = getModularInstance(other);
	        if (!(other instanceof QueryImpl)) {
	            return false;
	        }
	        const sameRepo = this._repo === other._repo;
	        const samePath = pathEquals(this._path, other._path);
	        const sameQueryIdentifier = this._queryIdentifier === other._queryIdentifier;
	        return sameRepo && samePath && sameQueryIdentifier;
	    }
	    toJSON() {
	        return this.toString();
	    }
	    toString() {
	        return this._repo.toString() + pathToUrlEncodedString(this._path);
	    }
	}
	/**
	 * @internal
	 */
	class ReferenceImpl extends QueryImpl {
	    /** @hideconstructor */
	    constructor(repo, path) {
	        super(repo, path, new QueryParams(), false);
	    }
	    get parent() {
	        const parentPath = pathParent(this._path);
	        return parentPath === null
	            ? null
	            : new ReferenceImpl(this._repo, parentPath);
	    }
	    get root() {
	        let ref = this;
	        while (ref.parent !== null) {
	            ref = ref.parent;
	        }
	        return ref;
	    }
	}
	/**
	 * A `DataSnapshot` contains data from a Database location.
	 *
	 * Any time you read data from the Database, you receive the data as a
	 * `DataSnapshot`. A `DataSnapshot` is passed to the event callbacks you attach
	 * with `on()` or `once()`. You can extract the contents of the snapshot as a
	 * JavaScript object by calling the `val()` method. Alternatively, you can
	 * traverse into the snapshot by calling `child()` to return child snapshots
	 * (which you could then call `val()` on).
	 *
	 * A `DataSnapshot` is an efficiently generated, immutable copy of the data at
	 * a Database location. It cannot be modified and will never change (to modify
	 * data, you always call the `set()` method on a `Reference` directly).
	 */
	class DataSnapshot {
	    /**
	     * @param _node - A SnapshotNode to wrap.
	     * @param ref - The location this snapshot came from.
	     * @param _index - The iteration order for this snapshot
	     * @hideconstructor
	     */
	    constructor(_node, 
	    /**
	     * The location of this DataSnapshot.
	     */
	    ref, _index) {
	        this._node = _node;
	        this.ref = ref;
	        this._index = _index;
	    }
	    /**
	     * Gets the priority value of the data in this `DataSnapshot`.
	     *
	     * Applications need not use priority but can order collections by
	     * ordinary properties (see
	     * {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data |Sorting and filtering data}
	     * ).
	     */
	    get priority() {
	        // typecast here because we never return deferred values or internal priorities (MAX_PRIORITY)
	        return this._node.getPriority().val();
	    }
	    /**
	     * The key (last part of the path) of the location of this `DataSnapshot`.
	     *
	     * The last token in a Database location is considered its key. For example,
	     * "ada" is the key for the /users/ada/ node. Accessing the key on any
	     * `DataSnapshot` will return the key for the location that generated it.
	     * However, accessing the key on the root URL of a Database will return
	     * `null`.
	     */
	    get key() {
	        return this.ref.key;
	    }
	    /** Returns the number of child properties of this `DataSnapshot`. */
	    get size() {
	        return this._node.numChildren();
	    }
	    /**
	     * Gets another `DataSnapshot` for the location at the specified relative path.
	     *
	     * Passing a relative path to the `child()` method of a DataSnapshot returns
	     * another `DataSnapshot` for the location at the specified relative path. The
	     * relative path can either be a simple child name (for example, "ada") or a
	     * deeper, slash-separated path (for example, "ada/name/first"). If the child
	     * location has no data, an empty `DataSnapshot` (that is, a `DataSnapshot`
	     * whose value is `null`) is returned.
	     *
	     * @param path - A relative path to the location of child data.
	     */
	    child(path) {
	        const childPath = new Path(path);
	        const childRef = child(this.ref, path);
	        return new DataSnapshot(this._node.getChild(childPath), childRef, PRIORITY_INDEX);
	    }
	    /**
	     * Returns true if this `DataSnapshot` contains any data. It is slightly more
	     * efficient than using `snapshot.val() !== null`.
	     */
	    exists() {
	        return !this._node.isEmpty();
	    }
	    /**
	     * Exports the entire contents of the DataSnapshot as a JavaScript object.
	     *
	     * The `exportVal()` method is similar to `val()`, except priority information
	     * is included (if available), making it suitable for backing up your data.
	     *
	     * @returns The DataSnapshot's contents as a JavaScript value (Object,
	     *   Array, string, number, boolean, or `null`).
	     */
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    exportVal() {
	        return this._node.val(true);
	    }
	    /**
	     * Enumerates the top-level children in the `IteratedDataSnapshot`.
	     *
	     * Because of the way JavaScript objects work, the ordering of data in the
	     * JavaScript object returned by `val()` is not guaranteed to match the
	     * ordering on the server nor the ordering of `onChildAdded()` events. That is
	     * where `forEach()` comes in handy. It guarantees the children of a
	     * `DataSnapshot` will be iterated in their query order.
	     *
	     * If no explicit `orderBy*()` method is used, results are returned
	     * ordered by key (unless priorities are used, in which case, results are
	     * returned by priority).
	     *
	     * @param action - A function that will be called for each child DataSnapshot.
	     * The callback can return true to cancel further enumeration.
	     * @returns true if enumeration was canceled due to your callback returning
	     * true.
	     */
	    forEach(action) {
	        if (this._node.isLeafNode()) {
	            return false;
	        }
	        const childrenNode = this._node;
	        // Sanitize the return value to a boolean. ChildrenNode.forEachChild has a weird return type...
	        return !!childrenNode.forEachChild(this._index, (key, node) => {
	            return action(new DataSnapshot(node, child(this.ref, key), PRIORITY_INDEX));
	        });
	    }
	    /**
	     * Returns true if the specified child path has (non-null) data.
	     *
	     * @param path - A relative path to the location of a potential child.
	     * @returns `true` if data exists at the specified child path; else
	     *  `false`.
	     */
	    hasChild(path) {
	        const childPath = new Path(path);
	        return !this._node.getChild(childPath).isEmpty();
	    }
	    /**
	     * Returns whether or not the `DataSnapshot` has any non-`null` child
	     * properties.
	     *
	     * You can use `hasChildren()` to determine if a `DataSnapshot` has any
	     * children. If it does, you can enumerate them using `forEach()`. If it
	     * doesn't, then either this snapshot contains a primitive value (which can be
	     * retrieved with `val()`) or it is empty (in which case, `val()` will return
	     * `null`).
	     *
	     * @returns true if this snapshot has any children; else false.
	     */
	    hasChildren() {
	        if (this._node.isLeafNode()) {
	            return false;
	        }
	        else {
	            return !this._node.isEmpty();
	        }
	    }
	    /**
	     * Returns a JSON-serializable representation of this object.
	     */
	    toJSON() {
	        return this.exportVal();
	    }
	    /**
	     * Extracts a JavaScript value from a `DataSnapshot`.
	     *
	     * Depending on the data in a `DataSnapshot`, the `val()` method may return a
	     * scalar type (string, number, or boolean), an array, or an object. It may
	     * also return null, indicating that the `DataSnapshot` is empty (contains no
	     * data).
	     *
	     * @returns The DataSnapshot's contents as a JavaScript value (Object,
	     *   Array, string, number, boolean, or `null`).
	     */
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    val() {
	        return this._node.val();
	    }
	}
	/**
	 *
	 * Returns a `Reference` representing the location in the Database
	 * corresponding to the provided path. If no path is provided, the `Reference`
	 * will point to the root of the Database.
	 *
	 * @param db - The database instance to obtain a reference for.
	 * @param path - Optional path representing the location the returned
	 *   `Reference` will point. If not provided, the returned `Reference` will
	 *   point to the root of the Database.
	 * @returns If a path is provided, a `Reference`
	 *   pointing to the provided path. Otherwise, a `Reference` pointing to the
	 *   root of the Database.
	 */
	function ref(db, path) {
	    db = getModularInstance(db);
	    db._checkNotDeleted('ref');
	    return path !== undefined ? child(db._root, path) : db._root;
	}
	/**
	 * Gets a `Reference` for the location at the specified relative path.
	 *
	 * The relative path can either be a simple child name (for example, "ada") or
	 * a deeper slash-separated path (for example, "ada/name/first").
	 *
	 * @param parent - The parent location.
	 * @param path - A relative path from this location to the desired child
	 *   location.
	 * @returns The specified child location.
	 */
	function child(parent, path) {
	    parent = getModularInstance(parent);
	    if (pathGetFront(parent._path) === null) {
	        validateRootPathString('child', 'path', path, false);
	    }
	    else {
	        validatePathString('child', 'path', path, false);
	    }
	    return new ReferenceImpl(parent._repo, pathChild(parent._path, path));
	}
	/**
	 * Writes data to this Database location.
	 *
	 * This will overwrite any data at this location and all child locations.
	 *
	 * The effect of the write will be visible immediately, and the corresponding
	 * events ("value", "child_added", etc.) will be triggered. Synchronization of
	 * the data to the Firebase servers will also be started, and the returned
	 * Promise will resolve when complete. If provided, the `onComplete` callback
	 * will be called asynchronously after synchronization has finished.
	 *
	 * Passing `null` for the new value is equivalent to calling `remove()`; namely,
	 * all data at this location and all child locations will be deleted.
	 *
	 * `set()` will remove any priority stored at this location, so if priority is
	 * meant to be preserved, you need to use `setWithPriority()` instead.
	 *
	 * Note that modifying data with `set()` will cancel any pending transactions
	 * at that location, so extreme care should be taken if mixing `set()` and
	 * `transaction()` to modify the same data.
	 *
	 * A single `set()` will generate a single "value" event at the location where
	 * the `set()` was performed.
	 *
	 * @param ref - The location to write to.
	 * @param value - The value to be written (string, number, boolean, object,
	 *   array, or null).
	 * @returns Resolves when write to server is complete.
	 */
	function set(ref, value) {
	    ref = getModularInstance(ref);
	    validateWritablePath('set', ref._path);
	    validateFirebaseDataArg('set', value, ref._path, false);
	    const deferred = new Deferred();
	    repoSetWithPriority(ref._repo, ref._path, value, 
	    /*priority=*/ null, deferred.wrapCallback(() => { }));
	    return deferred.promise;
	}
	/**
	 * Gets the most up-to-date result for this query.
	 *
	 * @param query - The query to run.
	 * @returns A `Promise` which resolves to the resulting DataSnapshot if a value is
	 * available, or rejects if the client is unable to return a value (e.g., if the
	 * server is unreachable and there is nothing cached).
	 */
	function get(query) {
	    query = getModularInstance(query);
	    const callbackContext = new CallbackContext(() => { });
	    const container = new ValueEventRegistration(callbackContext);
	    return repoGetValue(query._repo, query, container).then(node => {
	        return new DataSnapshot(node, new ReferenceImpl(query._repo, query._path), query._queryParams.getIndex());
	    });
	}
	/**
	 * Represents registration for 'value' events.
	 */
	class ValueEventRegistration {
	    constructor(callbackContext) {
	        this.callbackContext = callbackContext;
	    }
	    respondsTo(eventType) {
	        return eventType === 'value';
	    }
	    createEvent(change, query) {
	        const index = query._queryParams.getIndex();
	        return new DataEvent('value', this, new DataSnapshot(change.snapshotNode, new ReferenceImpl(query._repo, query._path), index));
	    }
	    getEventRunner(eventData) {
	        if (eventData.getEventType() === 'cancel') {
	            return () => this.callbackContext.onCancel(eventData.error);
	        }
	        else {
	            return () => this.callbackContext.onValue(eventData.snapshot, null);
	        }
	    }
	    createCancelEvent(error, path) {
	        if (this.callbackContext.hasCancelCallback) {
	            return new CancelEvent(this, error, path);
	        }
	        else {
	            return null;
	        }
	    }
	    matches(other) {
	        if (!(other instanceof ValueEventRegistration)) {
	            return false;
	        }
	        else if (!other.callbackContext || !this.callbackContext) {
	            // If no callback specified, we consider it to match any callback.
	            return true;
	        }
	        else {
	            return other.callbackContext.matches(this.callbackContext);
	        }
	    }
	    hasAnyCallback() {
	        return this.callbackContext !== null;
	    }
	}
	/**
	 * Represents the registration of a child_x event.
	 */
	class ChildEventRegistration {
	    constructor(eventType, callbackContext) {
	        this.eventType = eventType;
	        this.callbackContext = callbackContext;
	    }
	    respondsTo(eventType) {
	        let eventToCheck = eventType === 'children_added' ? 'child_added' : eventType;
	        eventToCheck =
	            eventToCheck === 'children_removed' ? 'child_removed' : eventToCheck;
	        return this.eventType === eventToCheck;
	    }
	    createCancelEvent(error, path) {
	        if (this.callbackContext.hasCancelCallback) {
	            return new CancelEvent(this, error, path);
	        }
	        else {
	            return null;
	        }
	    }
	    createEvent(change, query) {
	        assert(change.childName != null, 'Child events should have a childName.');
	        const childRef = child(new ReferenceImpl(query._repo, query._path), change.childName);
	        const index = query._queryParams.getIndex();
	        return new DataEvent(change.type, this, new DataSnapshot(change.snapshotNode, childRef, index), change.prevName);
	    }
	    getEventRunner(eventData) {
	        if (eventData.getEventType() === 'cancel') {
	            return () => this.callbackContext.onCancel(eventData.error);
	        }
	        else {
	            return () => this.callbackContext.onValue(eventData.snapshot, eventData.prevName);
	        }
	    }
	    matches(other) {
	        if (other instanceof ChildEventRegistration) {
	            return (this.eventType === other.eventType &&
	                (!this.callbackContext ||
	                    !other.callbackContext ||
	                    this.callbackContext.matches(other.callbackContext)));
	        }
	        return false;
	    }
	    hasAnyCallback() {
	        return !!this.callbackContext;
	    }
	}
	function addEventListener(query, eventType, callback, cancelCallbackOrListenOptions, options) {
	    let cancelCallback;
	    if (typeof cancelCallbackOrListenOptions === 'object') {
	        cancelCallback = undefined;
	        options = cancelCallbackOrListenOptions;
	    }
	    if (typeof cancelCallbackOrListenOptions === 'function') {
	        cancelCallback = cancelCallbackOrListenOptions;
	    }
	    if (options && options.onlyOnce) {
	        const userCallback = callback;
	        const onceCallback = (dataSnapshot, previousChildName) => {
	            repoRemoveEventCallbackForQuery(query._repo, query, container);
	            userCallback(dataSnapshot, previousChildName);
	        };
	        onceCallback.userCallback = callback.userCallback;
	        onceCallback.context = callback.context;
	        callback = onceCallback;
	    }
	    const callbackContext = new CallbackContext(callback, cancelCallback || undefined);
	    const container = eventType === 'value'
	        ? new ValueEventRegistration(callbackContext)
	        : new ChildEventRegistration(eventType, callbackContext);
	    repoAddEventCallbackForQuery(query._repo, query, container);
	    return () => repoRemoveEventCallbackForQuery(query._repo, query, container);
	}
	function onValue(query, callback, cancelCallbackOrListenOptions, options) {
	    return addEventListener(query, 'value', callback, cancelCallbackOrListenOptions, options);
	}
	/**
	 * Define reference constructor in various modules
	 *
	 * We are doing this here to avoid several circular
	 * dependency issues
	 */
	syncPointSetReferenceConstructor(ReferenceImpl);
	syncTreeSetReferenceConstructor(ReferenceImpl);

	/**
	 * @license
	 * Copyright 2020 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	/**
	 * This variable is also defined in the firebase Node.js Admin SDK. Before
	 * modifying this definition, consult the definition in:
	 *
	 * https://github.com/firebase/firebase-admin-node
	 *
	 * and make sure the two are consistent.
	 */
	const FIREBASE_DATABASE_EMULATOR_HOST_VAR = 'FIREBASE_DATABASE_EMULATOR_HOST';
	/**
	 * Creates and caches `Repo` instances.
	 */
	const repos = {};
	/**
	 * If true, any new `Repo` will be created to use `ReadonlyRestClient` (for testing purposes).
	 */
	let useRestClient = false;
	/**
	 * Update an existing `Repo` in place to point to a new host/port.
	 */
	function repoManagerApplyEmulatorSettings(repo, host, port, tokenProvider) {
	    repo.repoInfo_ = new RepoInfo(`${host}:${port}`, 
	    /* secure= */ false, repo.repoInfo_.namespace, repo.repoInfo_.webSocketOnly, repo.repoInfo_.nodeAdmin, repo.repoInfo_.persistenceKey, repo.repoInfo_.includeNamespaceInQueryParams, 
	    /*isUsingEmulator=*/ true);
	    if (tokenProvider) {
	        repo.authTokenProvider_ = tokenProvider;
	    }
	}
	/**
	 * This function should only ever be called to CREATE a new database instance.
	 * @internal
	 */
	function repoManagerDatabaseFromApp(app, authProvider, appCheckProvider, url, nodeAdmin) {
	    let dbUrl = url || app.options.databaseURL;
	    if (dbUrl === undefined) {
	        if (!app.options.projectId) {
	            fatal("Can't determine Firebase Database URL. Be sure to include " +
	                ' a Project ID when calling firebase.initializeApp().');
	        }
	        log('Using default host for project ', app.options.projectId);
	        dbUrl = `${app.options.projectId}-default-rtdb.firebaseio.com`;
	    }
	    let parsedUrl = parseRepoInfo(dbUrl, nodeAdmin);
	    let repoInfo = parsedUrl.repoInfo;
	    let isEmulator;
	    let dbEmulatorHost = undefined;
	    if (typeof process !== 'undefined' && process.env) {
	        dbEmulatorHost = process.env[FIREBASE_DATABASE_EMULATOR_HOST_VAR];
	    }
	    if (dbEmulatorHost) {
	        isEmulator = true;
	        dbUrl = `http://${dbEmulatorHost}?ns=${repoInfo.namespace}`;
	        parsedUrl = parseRepoInfo(dbUrl, nodeAdmin);
	        repoInfo = parsedUrl.repoInfo;
	    }
	    else {
	        isEmulator = !parsedUrl.repoInfo.secure;
	    }
	    const authTokenProvider = nodeAdmin && isEmulator
	        ? new EmulatorTokenProvider(EmulatorTokenProvider.OWNER)
	        : new FirebaseAuthTokenProvider(app.name, app.options, authProvider);
	    validateUrl('Invalid Firebase Database URL', parsedUrl);
	    if (!pathIsEmpty(parsedUrl.path)) {
	        fatal('Database URL must point to the root of a Firebase Database ' +
	            '(not including a child path).');
	    }
	    const repo = repoManagerCreateRepo(repoInfo, app, authTokenProvider, new AppCheckTokenProvider(app.name, appCheckProvider));
	    return new Database(repo, app);
	}
	/**
	 * Remove the repo and make sure it is disconnected.
	 *
	 */
	function repoManagerDeleteRepo(repo, appName) {
	    const appRepos = repos[appName];
	    // This should never happen...
	    if (!appRepos || appRepos[repo.key] !== repo) {
	        fatal(`Database ${appName}(${repo.repoInfo_}) has already been deleted.`);
	    }
	    repoInterrupt(repo);
	    delete appRepos[repo.key];
	}
	/**
	 * Ensures a repo doesn't already exist and then creates one using the
	 * provided app.
	 *
	 * @param repoInfo - The metadata about the Repo
	 * @returns The Repo object for the specified server / repoName.
	 */
	function repoManagerCreateRepo(repoInfo, app, authTokenProvider, appCheckProvider) {
	    let appRepos = repos[app.name];
	    if (!appRepos) {
	        appRepos = {};
	        repos[app.name] = appRepos;
	    }
	    let repo = appRepos[repoInfo.toURLString()];
	    if (repo) {
	        fatal('Database initialized multiple times. Please make sure the format of the database URL matches with each database() call.');
	    }
	    repo = new Repo(repoInfo, useRestClient, authTokenProvider, appCheckProvider);
	    appRepos[repoInfo.toURLString()] = repo;
	    return repo;
	}
	/**
	 * Class representing a Firebase Realtime Database.
	 */
	class Database {
	    /** @hideconstructor */
	    constructor(_repoInternal, 
	    /** The {@link @firebase/app#FirebaseApp} associated with this Realtime Database instance. */
	    app) {
	        this._repoInternal = _repoInternal;
	        this.app = app;
	        /** Represents a `Database` instance. */
	        this['type'] = 'database';
	        /** Track if the instance has been used (root or repo accessed) */
	        this._instanceStarted = false;
	    }
	    get _repo() {
	        if (!this._instanceStarted) {
	            repoStart(this._repoInternal, this.app.options.appId, this.app.options['databaseAuthVariableOverride']);
	            this._instanceStarted = true;
	        }
	        return this._repoInternal;
	    }
	    get _root() {
	        if (!this._rootInternal) {
	            this._rootInternal = new ReferenceImpl(this._repo, newEmptyPath());
	        }
	        return this._rootInternal;
	    }
	    _delete() {
	        if (this._rootInternal !== null) {
	            repoManagerDeleteRepo(this._repo, this.app.name);
	            this._repoInternal = null;
	            this._rootInternal = null;
	        }
	        return Promise.resolve();
	    }
	    _checkNotDeleted(apiName) {
	        if (this._rootInternal === null) {
	            fatal('Cannot call ' + apiName + ' on a deleted database.');
	        }
	    }
	}
	/**
	 * Returns the instance of the Realtime Database SDK that is associated with the provided
	 * {@link @firebase/app#FirebaseApp}. Initializes a new instance with default settings if
	 * no instance exists or if the existing instance uses a custom database URL.
	 *
	 * @param app - The {@link @firebase/app#FirebaseApp} instance that the returned Realtime
	 * Database instance is associated with.
	 * @param url - The URL of the Realtime Database instance to connect to. If not
	 * provided, the SDK connects to the default instance of the Firebase App.
	 * @returns The `Database` instance of the provided app.
	 */
	function getDatabase(app = getApp(), url) {
	    const db = _getProvider(app, 'database').getImmediate({
	        identifier: url
	    });
	    if (!db._instanceStarted) {
	        const emulator = getDefaultEmulatorHostnameAndPort('database');
	        if (emulator) {
	            connectDatabaseEmulator(db, ...emulator);
	        }
	    }
	    return db;
	}
	/**
	 * Modify the provided instance to communicate with the Realtime Database
	 * emulator.
	 *
	 * <p>Note: This method must be called before performing any other operation.
	 *
	 * @param db - The instance to modify.
	 * @param host - The emulator host (ex: localhost)
	 * @param port - The emulator port (ex: 8080)
	 * @param options.mockUserToken - the mock auth token to use for unit testing Security Rules
	 */
	function connectDatabaseEmulator(db, host, port, options = {}) {
	    db = getModularInstance(db);
	    db._checkNotDeleted('useEmulator');
	    if (db._instanceStarted) {
	        fatal('Cannot call useEmulator() after instance has already been initialized.');
	    }
	    const repo = db._repoInternal;
	    let tokenProvider = undefined;
	    if (repo.repoInfo_.nodeAdmin) {
	        if (options.mockUserToken) {
	            fatal('mockUserToken is not supported by the Admin SDK. For client access with mock users, please use the "firebase" package instead of "firebase-admin".');
	        }
	        tokenProvider = new EmulatorTokenProvider(EmulatorTokenProvider.OWNER);
	    }
	    else if (options.mockUserToken) {
	        const token = typeof options.mockUserToken === 'string'
	            ? options.mockUserToken
	            : createMockUserToken(options.mockUserToken, db.app.options.projectId);
	        tokenProvider = new EmulatorTokenProvider(token);
	    }
	    // Modify the repo to apply emulator settings
	    repoManagerApplyEmulatorSettings(repo, host, port, tokenProvider);
	}

	/**
	 * @license
	 * Copyright 2021 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *   http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	function registerDatabase(variant) {
	    setSDKVersion(SDK_VERSION$1);
	    _registerComponent(new Component('database', (container, { instanceIdentifier: url }) => {
	        const app = container.getProvider('app').getImmediate();
	        const authProvider = container.getProvider('auth-internal');
	        const appCheckProvider = container.getProvider('app-check-internal');
	        return repoManagerDatabaseFromApp(app, authProvider, appCheckProvider, url);
	    }, "PUBLIC" /* ComponentType.PUBLIC */).setMultipleInstances(true));
	    registerVersion(name, version, variant);
	    // BUILD_TARGET will be replaced by values like esm5, esm2017, cjs5, etc during the compilation
	    registerVersion(name, version, 'esm2017');
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	PersistentConnection.prototype.simpleListen = function (pathString, onComplete) {
	    this.sendRequest('q', { p: pathString }, onComplete);
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	PersistentConnection.prototype.echo = function (data, onEcho) {
	    this.sendRequest('echo', { d: data }, onEcho);
	};

	/**
	 * Firebase Realtime Database
	 *
	 * @packageDocumentation
	 */
	registerDatabase();

	/* src/components/routes/Login.svelte generated by Svelte v4.2.19 */

	const { Object: Object_1, console: console_1$3 } = globals;
	const file$3 = "src/components/routes/Login.svelte";

	// (96:8) {#if errorMessage}
	function create_if_block$1(ctx) {
		let p;
		let t;

		const block = {
			c: function create() {
				p = element("p");
				t = text(/*errorMessage*/ ctx[1]);
				attr_dev(p, "class", "text-red-400");
				add_location(p, file$3, 107, 12, 3375);
			},
			m: function mount(target, anchor) {
				insert_dev(target, p, anchor);
				append_dev(p, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*errorMessage*/ 2) set_data_dev(t, /*errorMessage*/ ctx[1]);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(p);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$1.name,
			type: "if",
			source: "(96:8) {#if errorMessage}",
			ctx
		});

		return block;
	}

	function create_fragment$3(ctx) {
		let div6;
		let div0;
		let h20;
		let t1;
		let t2;
		let form0;
		let input0;
		let t3;
		let button0;
		let t5;
		let div1;
		let h21;
		let t7;
		let form1;
		let input1;
		let t8;
		let button1;
		let t10;
		let div5;
		let div2;
		let h30;
		let i0;
		let t11;
		let t12;
		let p0;
		let t14;
		let div3;
		let h31;
		let i1;
		let t15;
		let t16;
		let p1;
		let t18;
		let p2;
		let strong0;
		let t20;
		let t21;
		let div4;
		let h32;
		let i2;
		let t22;
		let t23;
		let p3;
		let t24;
		let code0;
		let t26;
		let code1;
		let t28;
		let t29;
		let p4;
		let strong1;
		let t31;
		let ol;
		let li0;
		let t33;
		let li1;
		let t34;
		let code2;
		let t36;
		let t37;
		let li2;
		let t38;
		let code3;
		let t40;
		let t41;
		let li3;
		let t42;
		let code4;
		let t44;
		let t45;
		let li4;
		let t47;
		let link0;
		let t48;
		let link1;
		let mounted;
		let dispose;
		let if_block = /*errorMessage*/ ctx[1] && create_if_block$1(ctx);

		const block = {
			c: function create() {
				div6 = element("div");
				div0 = element("div");
				h20 = element("h2");
				h20.textContent = "Login";
				t1 = space();
				if (if_block) if_block.c();
				t2 = space();
				form0 = element("form");
				input0 = element("input");
				t3 = space();
				button0 = element("button");
				button0.textContent = "Entrar";
				t5 = space();
				div1 = element("div");
				h21 = element("h2");
				h21.textContent = "Registrar Chave de API";
				t7 = space();
				form1 = element("form");
				input1 = element("input");
				t8 = space();
				button1 = element("button");
				button1.textContent = "Registrar";
				t10 = space();
				div5 = element("div");
				div2 = element("div");
				h30 = element("h3");
				i0 = element("i");
				t11 = text("Sobre o Sistema");
				t12 = space();
				p0 = element("p");
				p0.textContent = "O sistema valida uma chave de API e carrega um banco de dados de mensagens, simulando endpoints para tratativa com logs, mensagens recebidas e enviadas.";
				t14 = space();
				div3 = element("div");
				h31 = element("h3");
				i1 = element("i");
				t15 = text("Ajuda");
				t16 = space();
				p1 = element("p");
				p1.textContent = "Para registrar uma nova chave de API, siga as instruções do sistema. Após registrar, você poderá validar suas mensagens.";
				t18 = space();
				p2 = element("p");
				strong0 = element("strong");
				strong0.textContent = "Observação:";
				t20 = text(" Você pode registrar uma chave falsa, só precisa ser o mesmo formato.");
				t21 = space();
				div4 = element("div");
				h32 = element("h3");
				i2 = element("i");
				t22 = text("Servidor Simulado");
				t23 = space();
				p3 = element("p");
				t24 = text("Inicie o servidor com o comando ");
				code0 = element("code");
				code0.textContent = "npm run dev";
				t26 = text(" para o front e ");
				code1 = element("code");
				code1.textContent = "node server.js";
				t28 = text(" para o backend.");
				t29 = space();
				p4 = element("p");
				strong1 = element("strong");
				strong1.textContent = "Instruções de instalação:";
				t31 = space();
				ol = element("ol");
				li0 = element("li");
				li0.textContent = "Clone o repositório.";
				t33 = space();
				li1 = element("li");
				t34 = text("Instale as dependências com ");
				code2 = element("code");
				code2.textContent = "npm install";
				t36 = text(".");
				t37 = space();
				li2 = element("li");
				t38 = text("Inicie o servidor com ");
				code3 = element("code");
				code3.textContent = "node server.js";
				t40 = text(" para o backend.");
				t41 = space();
				li3 = element("li");
				t42 = text("Execute ");
				code4 = element("code");
				code4.textContent = "npm run dev";
				t44 = text(" para rodar a aplicação no frontend.");
				t45 = space();
				li4 = element("li");
				li4.textContent = "Após registrar sua chave de API, você poderá testá-la.";
				t47 = space();
				link0 = element("link");
				t48 = space();
				link1 = element("link");
				attr_dev(h20, "class", "text-2xl mb-4");
				add_location(h20, file$3, 105, 8, 3299);
				attr_dev(input0, "type", "text");
				attr_dev(input0, "placeholder", "Insira sua chave de API");
				input0.required = true;
				attr_dev(input0, "class", "w-full p-2 mb-4 border-2 border-gray-600 bg-gray-700 text-gray-100");
				add_location(input0, file$3, 110, 12, 3484);
				attr_dev(button0, "type", "submit");
				attr_dev(button0, "class", "w-full py-2 bg-gray-700 text-gray-100 hover:bg-gray-600");
				add_location(button0, file$3, 117, 12, 3752);
				add_location(form0, file$3, 109, 8, 3440);
				attr_dev(div0, "class", "max-w-md w-full p-8 bg-gray-800 border-2 border-gray-600 rounded-lg text-center");
				add_location(div0, file$3, 104, 4, 3197);
				attr_dev(h21, "class", "text-2xl mb-4");
				add_location(h21, file$3, 128, 8, 4113);
				attr_dev(input1, "type", "text");
				attr_dev(input1, "placeholder", "Insira a nova chave de API");
				input1.required = true;
				attr_dev(input1, "class", "w-full p-2 mb-4 border-2 border-gray-600 bg-gray-700 text-gray-100");
				add_location(input1, file$3, 130, 12, 4221);
				attr_dev(button1, "type", "submit");
				attr_dev(button1, "class", "w-full py-2 bg-gray-700 text-gray-100 hover:bg-gray-600");
				add_location(button1, file$3, 137, 12, 4495);
				add_location(form1, file$3, 129, 8, 4175);
				attr_dev(div1, "class", "max-w-md w-full p-8 bg-gray-800 border-2 border-gray-600 rounded-lg text-center mt-6");
				add_location(div1, file$3, 127, 4, 4006);
				attr_dev(i0, "class", "fas fa-info-circle mr-2");
				add_location(i0, file$3, 150, 16, 4968);
				attr_dev(h30, "class", "text-lg mb-2");
				add_location(h30, file$3, 149, 12, 4926);
				add_location(p0, file$3, 152, 12, 5053);
				attr_dev(div2, "class", "bg-gray-800 border-2 border-gray-600 rounded-lg p-4 w-full max-w-md mb-4 text-center");
				add_location(div2, file$3, 148, 8, 4815);
				attr_dev(i1, "class", "fas fa-question-circle mr-2");
				add_location(i1, file$3, 158, 16, 5419);
				attr_dev(h31, "class", "text-lg mb-2");
				add_location(h31, file$3, 157, 12, 5377);
				add_location(p1, file$3, 160, 12, 5498);
				add_location(strong0, file$3, 164, 16, 5717);
				attr_dev(p2, "class", "text-yellow-400 mt-2");
				add_location(p2, file$3, 163, 12, 5668);
				attr_dev(div3, "class", "bg-gray-800 border-2 border-gray-600 rounded-lg p-4 w-full max-w-md mb-4 text-center");
				add_location(div3, file$3, 156, 8, 5266);
				attr_dev(i2, "class", "fas fa-server mr-2");
				add_location(i2, file$3, 169, 16, 6008);
				attr_dev(h32, "class", "text-lg mb-2");
				add_location(h32, file$3, 168, 12, 5966);
				add_location(code0, file$3, 172, 48, 6142);
				add_location(code1, file$3, 172, 88, 6182);
				add_location(p3, file$3, 171, 12, 6090);
				add_location(strong1, file$3, 174, 15, 6258);
				add_location(p4, file$3, 174, 12, 6255);
				add_location(li0, file$3, 176, 16, 6364);
				add_location(code2, file$3, 177, 48, 6442);
				add_location(li1, file$3, 177, 16, 6410);
				add_location(code3, file$3, 178, 42, 6515);
				add_location(li2, file$3, 178, 16, 6489);
				add_location(code4, file$3, 179, 28, 6592);
				add_location(li3, file$3, 179, 16, 6580);
				add_location(li4, file$3, 180, 16, 6674);
				attr_dev(ol, "class", "list-decimal pl-6");
				add_location(ol, file$3, 175, 12, 6317);
				attr_dev(div4, "class", "bg-gray-800 border-2 border-gray-600 rounded-lg p-4 w-full max-w-md mb-4 text-center");
				add_location(div4, file$3, 167, 8, 5855);
				attr_dev(div5, "class", "mt-6 flex flex-col items-center w-full px-4");
				add_location(div5, file$3, 147, 7, 4749);
				attr_dev(div6, "class", "flex flex-col items-center justify-center min-h-screen text-gray-100");
				add_location(div6, file$3, 103, 0, 3110);
				attr_dev(link0, "href", "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css");
				attr_dev(link0, "rel", "stylesheet");
				add_location(link0, file$3, 186, 0, 6790);
				attr_dev(link1, "href", "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css");
				attr_dev(link1, "rel", "stylesheet");
				add_location(link1, file$3, 187, 0, 6893);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div6, anchor);
				append_dev(div6, div0);
				append_dev(div0, h20);
				append_dev(div0, t1);
				if (if_block) if_block.m(div0, null);
				append_dev(div0, t2);
				append_dev(div0, form0);
				append_dev(form0, input0);
				set_input_value(input0, /*apiKey*/ ctx[0]);
				append_dev(form0, t3);
				append_dev(form0, button0);
				append_dev(div6, t5);
				append_dev(div6, div1);
				append_dev(div1, h21);
				append_dev(div1, t7);
				append_dev(div1, form1);
				append_dev(form1, input1);
				set_input_value(input1, /*newApiKey*/ ctx[2]);
				append_dev(form1, t8);
				append_dev(form1, button1);
				append_dev(div6, t10);
				append_dev(div6, div5);
				append_dev(div5, div2);
				append_dev(div2, h30);
				append_dev(h30, i0);
				append_dev(h30, t11);
				append_dev(div2, t12);
				append_dev(div2, p0);
				append_dev(div5, t14);
				append_dev(div5, div3);
				append_dev(div3, h31);
				append_dev(h31, i1);
				append_dev(h31, t15);
				append_dev(div3, t16);
				append_dev(div3, p1);
				append_dev(div3, t18);
				append_dev(div3, p2);
				append_dev(p2, strong0);
				append_dev(p2, t20);
				append_dev(div5, t21);
				append_dev(div5, div4);
				append_dev(div4, h32);
				append_dev(h32, i2);
				append_dev(h32, t22);
				append_dev(div4, t23);
				append_dev(div4, p3);
				append_dev(p3, t24);
				append_dev(p3, code0);
				append_dev(p3, t26);
				append_dev(p3, code1);
				append_dev(p3, t28);
				append_dev(div4, t29);
				append_dev(div4, p4);
				append_dev(p4, strong1);
				append_dev(div4, t31);
				append_dev(div4, ol);
				append_dev(ol, li0);
				append_dev(ol, t33);
				append_dev(ol, li1);
				append_dev(li1, t34);
				append_dev(li1, code2);
				append_dev(li1, t36);
				append_dev(ol, t37);
				append_dev(ol, li2);
				append_dev(li2, t38);
				append_dev(li2, code3);
				append_dev(li2, t40);
				append_dev(ol, t41);
				append_dev(ol, li3);
				append_dev(li3, t42);
				append_dev(li3, code4);
				append_dev(li3, t44);
				append_dev(ol, t45);
				append_dev(ol, li4);
				insert_dev(target, t47, anchor);
				insert_dev(target, link0, anchor);
				insert_dev(target, t48, anchor);
				insert_dev(target, link1, anchor);

				if (!mounted) {
					dispose = [
						listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
						listen_dev(form0, "submit", /*handleSubmit*/ ctx[3], false, false, false, false),
						listen_dev(input1, "input", /*input1_input_handler*/ ctx[6]),
						listen_dev(form1, "submit", /*handleRegister*/ ctx[4], false, false, false, false)
					];

					mounted = true;
				}
			},
			p: function update(ctx, [dirty]) {
				if (/*errorMessage*/ ctx[1]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block$1(ctx);
						if_block.c();
						if_block.m(div0, t2);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (dirty & /*apiKey*/ 1 && input0.value !== /*apiKey*/ ctx[0]) {
					set_input_value(input0, /*apiKey*/ ctx[0]);
				}

				if (dirty & /*newApiKey*/ 4 && input1.value !== /*newApiKey*/ ctx[2]) {
					set_input_value(input1, /*newApiKey*/ ctx[2]);
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div6);
					detach_dev(t47);
					detach_dev(link0);
					detach_dev(t48);
					detach_dev(link1);
				}

				if (if_block) if_block.d();
				mounted = false;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$3.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function isValidApiKey(key) {
		const apiKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		return apiKeyPattern.test(key);
	}

	function instance$3($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Login', slots, []);

		const firebaseConfig = {
			apiKey: "AIzaSyA7bdsMRoNvLc1fGk84tjjCzy8jQgT2VLc",
			authDomain: "svelte-blip-chatbo.firebaseapp.com",
			databaseURL: "https://svelte-blip-chatbo-default-rtdb.firebaseio.com",
			projectId: "svelte-blip-chatbo",
			storageBucket: "svelte-blip-chatbo.appspot.com",
			messagingSenderId: "494627128433",
			appId: "1:494627128433:web:99099a19db8eee632687d0"
		};

		const app = initializeApp(firebaseConfig);
		const db = getDatabase(app);

		// Variáveis de estado
		let apiKey = "";

		let errorMessage = "";
		let registeredApiKeys = [];
		let newApiKey = "";

		// Monta o componente e verifica chaves registradas
		onMount(() => {
			checkRegisteredApiKeys();
		});

		// Verifica chaves de API registradas no Firebase
		function checkRegisteredApiKeys() {
			const apiKeysRef = ref(db, "apiKeys/");

			get(apiKeysRef).then(snapshot => {
				if (snapshot.exists()) {
					registeredApiKeys = Object.keys(snapshot.val()).map(key => snapshot.val()[key].key);
				} else {
					console.log("No data available");
				}
			}).catch(error => {
				console.error("Erro ao buscar chaves de API:", error);
			});
		}

		// Autentica o usuário com a chave de API
		function authenticate() {
			if (registeredApiKeys.includes(apiKey)) {
				localStorage.setItem("apiKey", apiKey);
				navigate("/");
			} else {
				$$invalidate(1, errorMessage = "Chave de API inválida. Tente novamente.");
			}
		}

		// Manipula o envio do formulário de login
		function handleSubmit(event) {
			event.preventDefault();
			authenticate();
		}

		// Manipula o envio do formulário de registro
		function handleRegister(event) {
			event.preventDefault();

			if (isValidApiKey(newApiKey)) {
				// Verifica se a chave já está registrada
				if (registeredApiKeys.includes(newApiKey)) {
					alert("Essa chave de API já está registrada.");
					return;
				}

				registerApiKey(newApiKey); // Chama função para registrar a chave
			} else {
				alert("Chave de API inválida. O formato deve ser: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX");
			}
		}

		// Registra a nova chave de API no Firebase
		function registerApiKey(apiKey) {
			const apiKeyRef = ref(db, "apiKeys/" + apiKey);

			set(apiKeyRef, { key: apiKey }).then(() => {
				alert("Chave de API registrada com sucesso!");
				$$invalidate(2, newApiKey = ""); // Limpa o campo após o registro
				checkRegisteredApiKeys(); // Atualiza a lista de chaves registradas
			}).catch(error => {
				console.error("Erro ao registrar chave de API:", error);
				alert("Erro ao registrar chave de API. Tente novamente.");
			});
		}

		const writable_props = [];

		Object_1.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<Login> was created with unknown prop '${key}'`);
		});

		function input0_input_handler() {
			apiKey = this.value;
			$$invalidate(0, apiKey);
		}

		function input1_input_handler() {
			newApiKey = this.value;
			$$invalidate(2, newApiKey);
		}

		$$self.$capture_state = () => ({
			onMount,
			navigate,
			initializeApp,
			getDatabase,
			ref,
			set,
			get,
			firebaseConfig,
			app,
			db,
			apiKey,
			errorMessage,
			registeredApiKeys,
			newApiKey,
			checkRegisteredApiKeys,
			authenticate,
			handleSubmit,
			handleRegister,
			registerApiKey,
			isValidApiKey
		});

		$$self.$inject_state = $$props => {
			if ('apiKey' in $$props) $$invalidate(0, apiKey = $$props.apiKey);
			if ('errorMessage' in $$props) $$invalidate(1, errorMessage = $$props.errorMessage);
			if ('registeredApiKeys' in $$props) registeredApiKeys = $$props.registeredApiKeys;
			if ('newApiKey' in $$props) $$invalidate(2, newApiKey = $$props.newApiKey);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [
			apiKey,
			errorMessage,
			newApiKey,
			handleSubmit,
			handleRegister,
			input0_input_handler,
			input1_input_handler
		];
	}

	class Login extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Login",
				options,
				id: create_fragment$3.name
			});
		}
	}

	/* src/components/routes/ChatComponent.svelte generated by Svelte v4.2.19 */

	const { console: console_1$2 } = globals;
	const file$2 = "src/components/routes/ChatComponent.svelte";

	function get_each_context$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[9] = list[i];
		return child_ctx;
	}

	// (115:4) {#each messages as message}
	function create_each_block$1(ctx) {
		let div2;
		let div0;
		let t0_value = /*message*/ ctx[9].content + "";
		let t0;
		let t1;
		let div1;
		let t2_value = new Date(/*message*/ ctx[9].timestamp).toLocaleTimeString() + "";
		let t2;
		let div2_class_value;
		let div2_aria_label_value;

		const block = {
			c: function create() {
				div2 = element("div");
				div0 = element("div");
				t0 = text(t0_value);
				t1 = space();
				div1 = element("div");
				t2 = text(t2_value);
				attr_dev(div0, "class", "message-content svelte-6fj3y9");
				add_location(div0, file$2, 116, 12, 4841);
				attr_dev(div1, "class", "timestamp svelte-6fj3y9");
				add_location(div1, file$2, 119, 12, 4936);
				attr_dev(div2, "class", div2_class_value = "" + (null_to_empty(`message ${/*message*/ ctx[9].from === 'Você' ? 'user' : 'bot'}`) + " svelte-6fj3y9"));

				attr_dev(div2, "aria-label", div2_aria_label_value = /*message*/ ctx[9].from === 'Você'
				? 'Mensagem do usuário'
				: 'Mensagem do bot');

				add_location(div2, file$2, 115, 8, 4680);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div2, anchor);
				append_dev(div2, div0);
				append_dev(div0, t0);
				append_dev(div2, t1);
				append_dev(div2, div1);
				append_dev(div1, t2);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*messages*/ 1 && t0_value !== (t0_value = /*message*/ ctx[9].content + "")) set_data_dev(t0, t0_value);
				if (dirty & /*messages*/ 1 && t2_value !== (t2_value = new Date(/*message*/ ctx[9].timestamp).toLocaleTimeString() + "")) set_data_dev(t2, t2_value);

				if (dirty & /*messages*/ 1 && div2_class_value !== (div2_class_value = "" + (null_to_empty(`message ${/*message*/ ctx[9].from === 'Você' ? 'user' : 'bot'}`) + " svelte-6fj3y9"))) {
					attr_dev(div2, "class", div2_class_value);
				}

				if (dirty & /*messages*/ 1 && div2_aria_label_value !== (div2_aria_label_value = /*message*/ ctx[9].from === 'Você'
				? 'Mensagem do usuário'
				: 'Mensagem do bot')) {
					attr_dev(div2, "aria-label", div2_aria_label_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div2);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block$1.name,
			type: "each",
			source: "(115:4) {#each messages as message}",
			ctx
		});

		return block;
	}

	function create_fragment$2(ctx) {
		let div1;
		let h2;
		let t1;
		let t2;
		let div0;
		let input;
		let t3;
		let button;
		let mounted;
		let dispose;
		let each_value = ensure_array_like_dev(/*messages*/ ctx[0]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		const block = {
			c: function create() {
				div1 = element("div");
				h2 = element("h2");
				h2.textContent = "Conversa";
				t1 = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t2 = space();
				div0 = element("div");
				input = element("input");
				t3 = space();
				button = element("button");
				button.textContent = "Enviar";
				attr_dev(h2, "class", "svelte-6fj3y9");
				add_location(h2, file$2, 113, 4, 4622);
				attr_dev(input, "type", "text");
				attr_dev(input, "placeholder", "Digite sua mensagem...");
				attr_dev(input, "class", "input svelte-6fj3y9");
				add_location(input, file$2, 124, 8, 5090);
				attr_dev(button, "class", "send-button svelte-6fj3y9");
				add_location(button, file$2, 125, 8, 5195);
				attr_dev(div0, "class", "input-container svelte-6fj3y9");
				add_location(div0, file$2, 123, 4, 5052);
				attr_dev(div1, "class", "chat-container svelte-6fj3y9");
				attr_dev(div1, "aria-label", "Chat messages");
				add_location(div1, file$2, 112, 0, 4562);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div1, anchor);
				append_dev(div1, h2);
				append_dev(div1, t1);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div1, null);
					}
				}

				append_dev(div1, t2);
				append_dev(div1, div0);
				append_dev(div0, input);
				set_input_value(input, /*newMessage*/ ctx[1]);
				append_dev(div0, t3);
				append_dev(div0, button);

				if (!mounted) {
					dispose = [
						listen_dev(input, "input", /*input_input_handler*/ ctx[3]),
						listen_dev(button, "click", /*sendMessage*/ ctx[2], false, false, false, false)
					];

					mounted = true;
				}
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*messages, Date*/ 1) {
					each_value = ensure_array_like_dev(/*messages*/ ctx[0]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div1, t2);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}

				if (dirty & /*newMessage*/ 2 && input.value !== /*newMessage*/ ctx[1]) {
					set_input_value(input, /*newMessage*/ ctx[1]);
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div1);
				}

				destroy_each(each_blocks, detaching);
				mounted = false;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$2.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function scrollToBottom() {
		const chatContainer = document.querySelector('.chat-container');
		chatContainer.scrollTop = chatContainer.scrollHeight;
	}

	function initBlipChat() {
		const script = document.createElement('script');
		script.src = "https://unpkg.com/blip-chat-widget";

		script.onload = () => {
			new BlipChat().withAppKey('YXNrdG90aGV2ZXNzZWxvZmV4aXN0ZW5jZTE6ZDQ5MjUzZTUtNmEwOS00ZDRjLTgyZmItMDlkYzAxNjU4YzU0').withButton({ "color": "#00ff00", "icon": "" }).withCustomCommonUrl('https://rafael-correia-y0tjz.chat.blip.ai/').withFontColor('#ffffff').withBackgroundColor('#000000').withHeaderColor('#333333').withInputBackgroundColor('#222222').withInputFontColor('#ffffff').withMessageFromBotBackgroundColor('#444444').withMessageFromUserBackgroundColor('#555555').build();
		};

		document.head.appendChild(script);
	}

	function instance$2($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('ChatComponent', slots, []);

		var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
			function adopt(value) {
				return value instanceof P
				? value
				: new P(function (resolve) {
							resolve(value);
						});
			}

			return new (P || (P = Promise))(function (resolve, reject) {
					function fulfilled(value) {
						try {
							step(generator.next(value));
						} catch(e) {
							reject(e);
						}
					}

					function rejected(value) {
						try {
							step(generator["throw"](value));
						} catch(e) {
							reject(e);
						}
					}

					function step(result) {
						result.done
						? resolve(result.value)
						: adopt(result.value).then(fulfilled, rejected);
					}

					step((generator = generator.apply(thisArg, _arguments || [])).next());
				});
		};

		// Configurações do Firebase, chaves de testes e uso livre
		const firebaseConfig = {
			apiKey: "AIzaSyA7bdsMRoNvLc1fGk84tjjCzy8jQgT2VLc",
			authDomain: "svelte-blip-chatbo.firebaseapp.com",
			databaseURL: "https://svelte-blip-chatbo-default-rtdb.firebaseio.com",
			projectId: "svelte-blip-chatbo",
			storageBucket: "svelte-blip-chatbo.appspot.com",
			messagingSenderId: "494627128433",
			appId: "1:494627128433:web:99099a19db8eee632687d0"
		};

		// Inicializa o Firebase
		const app = initializeApp(firebaseConfig);

		const db = getDatabase(app);
		let messages = [];
		let newMessage = '';

		// Função para buscar mensagens do Firebase
		function fetchChatLogs() {
			const messagesRef = ref(db, 'messages');

			onValue(messagesRef, snapshot => {
				$$invalidate(0, messages = []); // Limpa mensagens antes de popular

				snapshot.forEach(childSnapshot => {
					const messageData = childSnapshot.val();

					messages.push({
						content: messageData.content,
						from: messageData.from,
						timestamp: messageData.timestamp
					});
				});

				scrollToBottom(); // Rola para a última mensagem quando as mensagens são atualizadas
			});
		}

		// Enviar nova mensagem para o Firebase e Blip
		function sendMessage() {
			return __awaiter(this, void 0, void 0, function* () {
				if (newMessage.trim() === '') return;

				const messageData = {
					content: newMessage,
					from: 'Você',
					timestamp: Date.now()
				};

				try {
					// Envio para o Firebase
					const messageRef = ref(db, 'messages/' + Date.now());

					yield set(messageRef, messageData);

					// Envio para o Blip
					yield fetch('https://withered-grass-6f5a.rafcs-x.workers.dev/', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							botAccessKey: 'YXNrdG90aGV2ZXNzZWxvZmV4aXN0ZW5jZTE6ZDQ5MjUzZTUtNmEwOS00ZDRjLTgyZmItMDlkYzAxNjU4YzU0',
							message: {
								from: 'Você',
								to: 'bot',
								content: { type: 'text', text: newMessage }
							}
						})
					});

					$$invalidate(1, newMessage = ''); // Limpa o campo de entrada
				} catch(error) {
					console.error('Erro ao enviar mensagem:', error);
				}
			});
		}

		// Rola automaticamente para a última mensagem
		onMount(() => {
			fetchChatLogs();
			initBlipChat(); // Inicializa o Blip Chat
		});

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<ChatComponent> was created with unknown prop '${key}'`);
		});

		function input_input_handler() {
			newMessage = this.value;
			$$invalidate(1, newMessage);
		}

		$$self.$capture_state = () => ({
			__awaiter,
			onMount,
			initializeApp,
			getDatabase,
			ref,
			set,
			onValue,
			firebaseConfig,
			app,
			db,
			messages,
			newMessage,
			fetchChatLogs,
			sendMessage,
			scrollToBottom,
			initBlipChat
		});

		$$self.$inject_state = $$props => {
			if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
			if ('messages' in $$props) $$invalidate(0, messages = $$props.messages);
			if ('newMessage' in $$props) $$invalidate(1, newMessage = $$props.newMessage);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [messages, newMessage, sendMessage, input_input_handler];
	}

	class ChatComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "ChatComponent",
				options,
				id: create_fragment$2.name
			});
		}
	}

	/* src/components/routes/Contacts.svelte generated by Svelte v4.2.19 */

	const { Error: Error_1, console: console_1$1 } = globals;
	const file$1 = "src/components/routes/Contacts.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[12] = list[i];
		child_ctx[14] = i;
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[15] = list[i];
		return child_ctx;
	}

	// (81:4) {#if errorMessage}
	function create_if_block_1(ctx) {
		let p;
		let t;

		const block = {
			c: function create() {
				p = element("p");
				t = text(/*errorMessage*/ ctx[3]);
				attr_dev(p, "class", "error svelte-amqnvo");
				add_location(p, file$1, 83, 8, 3050);
			},
			m: function mount(target, anchor) {
				insert_dev(target, p, anchor);
				append_dev(p, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*errorMessage*/ 8) set_data_dev(t, /*errorMessage*/ ctx[3]);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(p);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1.name,
			type: "if",
			source: "(81:4) {#if errorMessage}",
			ctx
		});

		return block;
	}

	// (86:4) {:else}
	function create_else_block(ctx) {
		let ul;
		let t;
		let div;
		let each_value_1 = ensure_array_like_dev(/*currentContacts*/ ctx[5]());
		let each_blocks_1 = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		let each_value = ensure_array_like_dev(Array(Math.ceil(/*totalContacts*/ ctx[2] / contactsPerPage)));
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		const block = {
			c: function create() {
				ul = element("ul");

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t = space();
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(ul, "class", "contact-list svelte-amqnvo");
				add_location(ul, file$1, 88, 8, 3190);
				attr_dev(div, "class", "pagination svelte-amqnvo");
				add_location(div, file$1, 102, 8, 3656);
			},
			m: function mount(target, anchor) {
				insert_dev(target, ul, anchor);

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(ul, null);
					}
				}

				insert_dev(target, t, anchor);
				insert_dev(target, div, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div, null);
					}
				}
			},
			p: function update(ctx, dirty) {
				if (dirty & /*goToConversation, currentContacts*/ 48) {
					each_value_1 = ensure_array_like_dev(/*currentContacts*/ ctx[5]());
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
						} else {
							each_blocks_1[i] = create_each_block_1(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].m(ul, null);
						}
					}

					for (; i < each_blocks_1.length; i += 1) {
						each_blocks_1[i].d(1);
					}

					each_blocks_1.length = each_value_1.length;
				}

				if (dirty & /*currentPage, changePage, totalContacts*/ 70) {
					each_value = ensure_array_like_dev(Array(Math.ceil(/*totalContacts*/ ctx[2] / contactsPerPage)));
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(ul);
					detach_dev(t);
					detach_dev(div);
				}

				destroy_each(each_blocks_1, detaching);
				destroy_each(each_blocks, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block.name,
			type: "else",
			source: "(86:4) {:else}",
			ctx
		});

		return block;
	}

	// (84:4) {#if contacts.length === 0}
	function create_if_block(ctx) {
		let p;

		const block = {
			c: function create() {
				p = element("p");
				p.textContent = "Nenhum contato encontrado.";
				add_location(p, file$1, 86, 8, 3136);
			},
			m: function mount(target, anchor) {
				insert_dev(target, p, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(p);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block.name,
			type: "if",
			source: "(84:4) {#if contacts.length === 0}",
			ctx
		});

		return block;
	}

	// (88:12) {#each currentContacts() as contact}
	function create_each_block_1(ctx) {
		let li;
		let button;
		let i;
		let t0;
		let t1_value = /*contact*/ ctx[15].name + "";
		let t1;
		let t2;
		let mounted;
		let dispose;

		function click_handler() {
			return /*click_handler*/ ctx[7](/*contact*/ ctx[15]);
		}

		const block = {
			c: function create() {
				li = element("li");
				button = element("button");
				i = element("i");
				t0 = space();
				t1 = text(t1_value);
				t2 = space();
				attr_dev(i, "class", "fas fa-user");
				add_location(i, file$1, 96, 24, 3518);
				attr_dev(button, "type", "button");
				attr_dev(button, "class", "contact-button svelte-amqnvo");
				add_location(button, file$1, 91, 20, 3306);
				add_location(li, file$1, 90, 16, 3281);
			},
			m: function mount(target, anchor) {
				insert_dev(target, li, anchor);
				append_dev(li, button);
				append_dev(button, i);
				append_dev(button, t0);
				append_dev(button, t1);
				append_dev(li, t2);

				if (!mounted) {
					dispose = listen_dev(button, "click", click_handler, false, false, false, false);
					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(li);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block_1.name,
			type: "each",
			source: "(88:12) {#each currentContacts() as contact}",
			ctx
		});

		return block;
	}

	// (102:12) {#each Array(Math.ceil(totalContacts / contactsPerPage)) as _, index}
	function create_each_block(ctx) {
		let button;
		let t0_value = /*index*/ ctx[14] + 1 + "";
		let t0;
		let t1;
		let button_disabled_value;
		let button_class_value;
		let mounted;
		let dispose;

		function click_handler_1() {
			return /*click_handler_1*/ ctx[8](/*index*/ ctx[14]);
		}

		const block = {
			c: function create() {
				button = element("button");
				t0 = text(t0_value);
				t1 = space();
				button.disabled = button_disabled_value = /*currentPage*/ ctx[1] === /*index*/ ctx[14] + 1;

				attr_dev(button, "class", button_class_value = "page-button " + (/*currentPage*/ ctx[1] === /*index*/ ctx[14] + 1
				? 'disabled'
				: '') + " svelte-amqnvo");

				add_location(button, file$1, 104, 16, 3779);
			},
			m: function mount(target, anchor) {
				insert_dev(target, button, anchor);
				append_dev(button, t0);
				append_dev(button, t1);

				if (!mounted) {
					dispose = listen_dev(button, "click", click_handler_1, false, false, false, false);
					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;

				if (dirty & /*currentPage*/ 2 && button_disabled_value !== (button_disabled_value = /*currentPage*/ ctx[1] === /*index*/ ctx[14] + 1)) {
					prop_dev(button, "disabled", button_disabled_value);
				}

				if (dirty & /*currentPage*/ 2 && button_class_value !== (button_class_value = "page-button " + (/*currentPage*/ ctx[1] === /*index*/ ctx[14] + 1
				? 'disabled'
				: '') + " svelte-amqnvo")) {
					attr_dev(button, "class", button_class_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(button);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block.name,
			type: "each",
			source: "(102:12) {#each Array(Math.ceil(totalContacts / contactsPerPage)) as _, index}",
			ctx
		});

		return block;
	}

	function create_fragment$1(ctx) {
		let div;
		let h1;
		let t1;
		let t2;
		let if_block0 = /*errorMessage*/ ctx[3] && create_if_block_1(ctx);

		function select_block_type(ctx, dirty) {
			if (/*contacts*/ ctx[0].length === 0) return create_if_block;
			return create_else_block;
		}

		let current_block_type = select_block_type(ctx);
		let if_block1 = current_block_type(ctx);

		const block = {
			c: function create() {
				div = element("div");
				h1 = element("h1");
				h1.textContent = "Lista de Contatos";
				t1 = space();
				if (if_block0) if_block0.c();
				t2 = space();
				if_block1.c();
				attr_dev(h1, "class", "title svelte-amqnvo");
				add_location(h1, file$1, 81, 4, 2978);
				attr_dev(div, "class", "container svelte-amqnvo");
				add_location(div, file$1, 80, 0, 2950);
			},
			l: function claim(nodes) {
				throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, h1);
				append_dev(div, t1);
				if (if_block0) if_block0.m(div, null);
				append_dev(div, t2);
				if_block1.m(div, null);
			},
			p: function update(ctx, [dirty]) {
				if (/*errorMessage*/ ctx[3]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_1(ctx);
						if_block0.c();
						if_block0.m(div, t2);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1.d(1);
					if_block1 = current_block_type(ctx);

					if (if_block1) {
						if_block1.c();
						if_block1.m(div, null);
					}
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				if (if_block0) if_block0.d();
				if_block1.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$1.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	const contactsPerPage = 10;

	function instance$1($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Contacts', slots, []);

		var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
			function adopt(value) {
				return value instanceof P
				? value
				: new P(function (resolve) {
							resolve(value);
						});
			}

			return new (P || (P = Promise))(function (resolve, reject) {
					function fulfilled(value) {
						try {
							step(generator.next(value));
						} catch(e) {
							reject(e);
						}
					}

					function rejected(value) {
						try {
							step(generator["throw"](value));
						} catch(e) {
							reject(e);
						}
					}

					function step(result) {
						result.done
						? resolve(result.value)
						: adopt(result.value).then(fulfilled, rejected);
					}

					step((generator = generator.apply(thisArg, _arguments || [])).next());
				});
		};

		let contacts = [];
		let currentPage = 1;
		let totalContacts = 0;
		const apiKey = localStorage.getItem('apiKey');
		let errorMessage = '';

		function fetchContacts() {
			return __awaiter(this, void 0, void 0, function* () {
				try {
					console.log('Fetching contacts...');
					console.log('API Key:', apiKey);

					const response = yield fetch(`http://localhost:3000/api/contacts`, {
						method: 'GET',
						headers: {
							'Authorization': `Bearer ${apiKey}`,
							'Content-Type': 'application/json'
						}
					});

					if (!response.ok) {
						if (response.status === 401) {
							$$invalidate(3, errorMessage = 'Unauthorized access. Please log in again.');
						} else if (response.status === 404) {
							$$invalidate(3, errorMessage = 'Contacts not found.');
						} else {
							$$invalidate(3, errorMessage = 'Error fetching contacts. Please try again later.');
						}

						throw new Error('Failed to fetch contacts');
					}

					const data = yield response.json();
					console.log('Fetched data:', data);
					$$invalidate(0, contacts = data.contacts || []);
					$$invalidate(2, totalContacts = contacts.length);
				} catch(error) {
					console.error('Error:', error);
					$$invalidate(3, errorMessage = 'Erro ao buscar contatos. Redirecionando para login...');

					setTimeout(
						() => {
							navigate('/login');
						},
						3000
					);
				}
			});
		}

		function goToConversation(contactId) {
			console.log('Navigating to conversation with contact ID:', contactId);
			navigate(`/contato/${contactId}`);
		}

		function currentContacts() {
			const startIndex = (currentPage - 1) * contactsPerPage;
			const current = contacts.slice(startIndex, startIndex + contactsPerPage);
			console.log('Current contacts:', current);
			return current;
		}

		function changePage(page) {
			$$invalidate(1, currentPage = page);
		}

		onMount(() => {
			if (!apiKey) {
				navigate('/login');
			} else {
				fetchContacts();
			}
		});

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Contacts> was created with unknown prop '${key}'`);
		});

		const click_handler = contact => goToConversation(contact.id);
		const click_handler_1 = index => changePage(index + 1);

		$$self.$capture_state = () => ({
			__awaiter,
			onMount,
			navigate,
			contacts,
			currentPage,
			contactsPerPage,
			totalContacts,
			apiKey,
			errorMessage,
			fetchContacts,
			goToConversation,
			currentContacts,
			changePage
		});

		$$self.$inject_state = $$props => {
			if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
			if ('contacts' in $$props) $$invalidate(0, contacts = $$props.contacts);
			if ('currentPage' in $$props) $$invalidate(1, currentPage = $$props.currentPage);
			if ('totalContacts' in $$props) $$invalidate(2, totalContacts = $$props.totalContacts);
			if ('errorMessage' in $$props) $$invalidate(3, errorMessage = $$props.errorMessage);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [
			contacts,
			currentPage,
			totalContacts,
			errorMessage,
			goToConversation,
			currentContacts,
			changePage,
			click_handler,
			click_handler_1
		];
	}

	class Contacts extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Contacts",
				options,
				id: create_fragment$1.name
			});
		}
	}

	/* src/App.svelte generated by Svelte v4.2.19 */

	const { console: console_1 } = globals;
	const file = "src/App.svelte";

	// (74:0) <Router>
	function create_default_slot(ctx) {
		let navbar;
		let t0;
		let main;
		let route0;
		let t1;
		let route1;
		let t2;
		let route2;
		let t3;
		let route3;
		let current;
		navbar = new Navbar({ $$inline: true });

		route0 = new Route({
				props: { path: "/", component: Home },
				$$inline: true
			});

		route1 = new Route({
				props: { path: "/login", component: Login },
				$$inline: true
			});

		route2 = new Route({
				props: { path: "/contatos", component: Contacts },
				$$inline: true
			});

		route3 = new Route({
				props: {
					path: "/contato/:id",
					component: ChatComponent
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(navbar.$$.fragment);
				t0 = space();
				main = element("main");
				create_component(route0.$$.fragment);
				t1 = space();
				create_component(route1.$$.fragment);
				t2 = space();
				create_component(route2.$$.fragment);
				t3 = space();
				create_component(route3.$$.fragment);
				attr_dev(main, "class", "svelte-gv28hk");
				add_location(main, file, 75, 4, 2838);
			},
			m: function mount(target, anchor) {
				mount_component(navbar, target, anchor);
				insert_dev(target, t0, anchor);
				insert_dev(target, main, anchor);
				mount_component(route0, main, null);
				append_dev(main, t1);
				mount_component(route1, main, null);
				append_dev(main, t2);
				mount_component(route2, main, null);
				append_dev(main, t3);
				mount_component(route3, main, null);
				current = true;
			},
			p: noop,
			i: function intro(local) {
				if (current) return;
				transition_in(navbar.$$.fragment, local);
				transition_in(route0.$$.fragment, local);
				transition_in(route1.$$.fragment, local);
				transition_in(route2.$$.fragment, local);
				transition_in(route3.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(navbar.$$.fragment, local);
				transition_out(route0.$$.fragment, local);
				transition_out(route1.$$.fragment, local);
				transition_out(route2.$$.fragment, local);
				transition_out(route3.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(t0);
					detach_dev(main);
				}

				destroy_component(navbar, detaching);
				destroy_component(route0);
				destroy_component(route1);
				destroy_component(route2);
				destroy_component(route3);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot.name,
			type: "slot",
			source: "(74:0) <Router>",
			ctx
		});

		return block;
	}

	function create_fragment(ctx) {
		let router;
		let current;

		router = new Router({
				props: {
					$$slots: { default: [create_default_slot] },
					$$scope: { ctx }
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(router.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(router, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const router_changes = {};

				if (dirty & /*$$scope*/ 1) {
					router_changes.$$scope = { dirty, ctx };
				}

				router.$set(router_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(router.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(router.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(router, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	async function sendToWebhook(payload) {
		const webhookUrl = undefined.MYAPP_WEBHOOK_URL; // Use a variável de ambiente aqui

		try {
			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				console.error('Erro ao enviar dados para o webhook:', response.statusText);
			}
		} catch(error) {
			console.error('Erro na requisição ao webhook:', error);
		}
	}

	function instance($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('App', slots, []);

		onMount(() => {
			const script = document.createElement('script');
			script.src = 'https://unpkg.com/blip-chat-widget';
			script.type = 'text/javascript';

			script.onload = () => {
				const blipChat = new BlipChat().withAppKey(undefined.MYAPP_FIREBASE_API_KEY).withButton(
					{ "color": "#0096fa", "icon": "" }
				).withCustomCommonUrl(undefined.MYAPP_FIREBASE_AUTH_DOMAIN).build(); // Outro exemplo

				blipChat.on('send', message => {
					const payload = {
						botAccessKey: undefined.MYAPP_FIREBASE_APP_ID, // Use a variável de ambiente aqui
						message: {
							content: message.content,
							type: message.type,
							from: message.from,
							to: message.to,
							timestamp: new Date().toISOString()
						}
					};

					sendToWebhook(payload);
				});

				blipChat.on('receive', message => {
					const payload = {
						botAccessKey: undefined.MYAPP_FIREBASE_APP_ID, // Use a variável de ambiente aqui
						message: {
							content: message.content,
							type: message.type,
							from: message.from,
							to: message.to,
							timestamp: new Date().toISOString()
						}
					};

					sendToWebhook(payload);
				});
			};

			document.body.appendChild(script);
		});

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
		});

		$$self.$capture_state = () => ({
			Router,
			Route,
			Navbar,
			Home,
			Login,
			ChatComponent,
			Contacts,
			onMount,
			sendToWebhook
		});

		return [];
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "App",
				options,
				id: create_fragment.name
			});
		}
	}

	var app = new App({
	  target: document.body,
	  props: {
	    name: 'world'
	  }
	});

	return app;

})();
//# sourceMappingURL=bundle.js.map
