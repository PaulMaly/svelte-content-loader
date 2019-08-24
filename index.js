(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.ContentLoader = {}));
}(this, function (exports) { 'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function create_slot(definition, ctx, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, fn) {
        return definition[1]
            ? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
            : ctx.$$scope.ctx;
    }
    function get_slot_changes(definition, ctx, changed, fn) {
        return definition[1]
            ? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
            : ctx.$$scope.changed || {};
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    /* src/ContentLoader.svelte generated by Svelte v3.9.1 */

    // (16:4) {#if animate}
    function create_if_block_2(ctx) {
    	var animate_1, animate_1_dur_value;

    	return {
    		c() {
    			animate_1 = svg_element("animate");
    			attr(animate_1, "dur", animate_1_dur_value = "" + ctx.speed + "s");
    			attr(animate_1, "values", "-2; 1");
    			attr(animate_1, "attributeName", "offset");
    			attr(animate_1, "repeatCount", "indefinite");
    		},

    		m(target, anchor) {
    			insert(target, animate_1, anchor);
    		},

    		p(changed, ctx) {
    			if ((changed.speed) && animate_1_dur_value !== (animate_1_dur_value = "" + ctx.speed + "s")) {
    				attr(animate_1, "dur", animate_1_dur_value);
    			}
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(animate_1);
    			}
    		}
    	};
    }

    // (26:4) {#if animate}
    function create_if_block_1(ctx) {
    	var animate_1, animate_1_dur_value;

    	return {
    		c() {
    			animate_1 = svg_element("animate");
    			attr(animate_1, "dur", animate_1_dur_value = "" + ctx.speed + "s");
    			attr(animate_1, "values", "-1.5; 1.5");
    			attr(animate_1, "attributeName", "offset");
    			attr(animate_1, "repeatCount", "indefinite");
    		},

    		m(target, anchor) {
    			insert(target, animate_1, anchor);
    		},

    		p(changed, ctx) {
    			if ((changed.speed) && animate_1_dur_value !== (animate_1_dur_value = "" + ctx.speed + "s")) {
    				attr(animate_1, "dur", animate_1_dur_value);
    			}
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(animate_1);
    			}
    		}
    	};
    }

    // (36:4) {#if animate}
    function create_if_block(ctx) {
    	var animate_1, animate_1_dur_value;

    	return {
    		c() {
    			animate_1 = svg_element("animate");
    			attr(animate_1, "dur", animate_1_dur_value = "" + ctx.speed + "s");
    			attr(animate_1, "values", "-1; 2");
    			attr(animate_1, "attributeName", "offset");
    			attr(animate_1, "repeatCount", "indefinite");
    		},

    		m(target, anchor) {
    			insert(target, animate_1, anchor);
    		},

    		p(changed, ctx) {
    			if ((changed.speed) && animate_1_dur_value !== (animate_1_dur_value = "" + ctx.speed + "s")) {
    				attr(animate_1, "dur", animate_1_dur_value);
    			}
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(animate_1);
    			}
    		}
    	};
    }

    function create_fragment(ctx) {
    	var svg, rect0, rect0_clip_path_value, defs, clipPath, rect1, linearGradient, stop0, stop1, stop2, svg_viewBox_value, current;

    	const default_slot_template = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_template, ctx, null);

    	var if_block0 = (ctx.animate) && create_if_block_2(ctx);

    	var if_block1 = (ctx.animate) && create_if_block_1(ctx);

    	var if_block2 = (ctx.animate) && create_if_block(ctx);

    	return {
    		c() {
    			svg = svg_element("svg");
    			rect0 = svg_element("rect");
    			defs = svg_element("defs");
    			clipPath = svg_element("clipPath");

    			if (!default_slot) {
    				rect1 = svg_element("rect");
    			}

    			if (default_slot) default_slot.c();
    			linearGradient = svg_element("linearGradient");
    			stop0 = svg_element("stop");
    			if (if_block0) if_block0.c();
    			stop1 = svg_element("stop");
    			if (if_block1) if_block1.c();
    			stop2 = svg_element("stop");
    			if (if_block2) if_block2.c();
    			set_style(rect0, "fill", "url(" + ctx.baseUrl + "#" + ctx.idGradient + ")");
    			attr(rect0, "clip-path", rect0_clip_path_value = "url(" + ctx.baseUrl + "#" + ctx.idClip + ")");
    			attr(rect0, "width", ctx.width);
    			attr(rect0, "height", ctx.height);
    			attr(rect0, "x", "0");
    			attr(rect0, "y", "0");

    			if (!default_slot) {
    				attr(rect1, "width", ctx.width);
    				attr(rect1, "height", ctx.height);
    				attr(rect1, "x", "0");
    				attr(rect1, "y", "0");
    				attr(rect1, "rx", "5");
    				attr(rect1, "ry", "5");
    			}

    			attr(clipPath, "id", ctx.idClip);
    			attr(stop0, "stop-color", ctx.primaryColor);
    			attr(stop0, "stop-opacity", ctx.primaryOpacity);
    			attr(stop0, "offset", "0%");
    			attr(stop1, "stop-color", ctx.secondaryColor);
    			attr(stop1, "stop-opacity", ctx.secondaryOpacity);
    			attr(stop1, "offset", "50%");
    			attr(stop2, "stop-color", ctx.primaryColor);
    			attr(stop2, "stop-opacity", ctx.primaryOpacity);
    			attr(stop2, "offset", "100%");
    			attr(linearGradient, "id", ctx.idGradient);
    			attr(svg, "viewBox", svg_viewBox_value = "0 0 " + ctx.width + " " + ctx.height);
    			attr(svg, "version", "1.1");
    			attr(svg, "preserveAspectRatio", ctx.preserveAspectRatio);
    		},

    		l(nodes) {
    			if (default_slot) default_slot.l(clipPath_nodes);
    		},

    		m(target, anchor) {
    			insert(target, svg, anchor);
    			append(svg, rect0);
    			append(svg, defs);
    			append(defs, clipPath);

    			if (!default_slot) {
    				append(clipPath, rect1);
    			}

    			else {
    				default_slot.m(clipPath, null);
    			}

    			append(defs, linearGradient);
    			append(linearGradient, stop0);
    			if (if_block0) if_block0.m(stop0, null);
    			append(linearGradient, stop1);
    			if (if_block1) if_block1.m(stop1, null);
    			append(linearGradient, stop2);
    			if (if_block2) if_block2.m(stop2, null);
    			current = true;
    		},

    		p(changed, ctx) {
    			if (!current || changed.baseUrl || changed.idGradient) {
    				set_style(rect0, "fill", "url(" + ctx.baseUrl + "#" + ctx.idGradient + ")");
    			}

    			if ((!current || changed.baseUrl || changed.idClip) && rect0_clip_path_value !== (rect0_clip_path_value = "url(" + ctx.baseUrl + "#" + ctx.idClip + ")")) {
    				attr(rect0, "clip-path", rect0_clip_path_value);
    			}

    			if (!current || changed.width) {
    				attr(rect0, "width", ctx.width);
    			}

    			if (!current || changed.height) {
    				attr(rect0, "height", ctx.height);
    			}

    			if (!default_slot) {
    				if (!current || changed.width) {
    					attr(rect1, "width", ctx.width);
    				}

    				if (!current || changed.height) {
    					attr(rect1, "height", ctx.height);
    				}
    			}

    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(
    					get_slot_changes(default_slot_template, ctx, changed, null),
    					get_slot_context(default_slot_template, ctx, null)
    				);
    			}

    			if (!current || changed.idClip) {
    				attr(clipPath, "id", ctx.idClip);
    			}

    			if (ctx.animate) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(stop0, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!current || changed.primaryColor) {
    				attr(stop0, "stop-color", ctx.primaryColor);
    			}

    			if (!current || changed.primaryOpacity) {
    				attr(stop0, "stop-opacity", ctx.primaryOpacity);
    			}

    			if (ctx.animate) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(stop1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (!current || changed.secondaryColor) {
    				attr(stop1, "stop-color", ctx.secondaryColor);
    			}

    			if (!current || changed.secondaryOpacity) {
    				attr(stop1, "stop-opacity", ctx.secondaryOpacity);
    			}

    			if (ctx.animate) {
    				if (if_block2) {
    					if_block2.p(changed, ctx);
    				} else {
    					if_block2 = create_if_block(ctx);
    					if_block2.c();
    					if_block2.m(stop2, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (!current || changed.primaryColor) {
    				attr(stop2, "stop-color", ctx.primaryColor);
    			}

    			if (!current || changed.primaryOpacity) {
    				attr(stop2, "stop-opacity", ctx.primaryOpacity);
    			}

    			if (!current || changed.idGradient) {
    				attr(linearGradient, "id", ctx.idGradient);
    			}

    			if ((!current || changed.width || changed.height) && svg_viewBox_value !== (svg_viewBox_value = "0 0 " + ctx.width + " " + ctx.height)) {
    				attr(svg, "viewBox", svg_viewBox_value);
    			}

    			if (!current || changed.preserveAspectRatio) {
    				attr(svg, "preserveAspectRatio", ctx.preserveAspectRatio);
    			}
    		},

    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},

    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(svg);
    			}

    			if (default_slot) default_slot.d(detaching);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};
    }

    function uid() {
    	return Math.random().toString(36).substring(2);
    }

    function instance($$self, $$props, $$invalidate) {
    	
    	
    	let { preserveAspectRatio = 'xMidYMid meet', secondaryColor = '#ecebeb', primaryColor = '#f9f9f9', secondaryOpacity = 1, primaryOpacity = 1, animate = true, baseUrl = '', height = 130, width = 400, speed = 2, uniqueKey } = $$props;

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$props => {
    		if ('preserveAspectRatio' in $$props) $$invalidate('preserveAspectRatio', preserveAspectRatio = $$props.preserveAspectRatio);
    		if ('secondaryColor' in $$props) $$invalidate('secondaryColor', secondaryColor = $$props.secondaryColor);
    		if ('primaryColor' in $$props) $$invalidate('primaryColor', primaryColor = $$props.primaryColor);
    		if ('secondaryOpacity' in $$props) $$invalidate('secondaryOpacity', secondaryOpacity = $$props.secondaryOpacity);
    		if ('primaryOpacity' in $$props) $$invalidate('primaryOpacity', primaryOpacity = $$props.primaryOpacity);
    		if ('animate' in $$props) $$invalidate('animate', animate = $$props.animate);
    		if ('baseUrl' in $$props) $$invalidate('baseUrl', baseUrl = $$props.baseUrl);
    		if ('height' in $$props) $$invalidate('height', height = $$props.height);
    		if ('width' in $$props) $$invalidate('width', width = $$props.width);
    		if ('speed' in $$props) $$invalidate('speed', speed = $$props.speed);
    		if ('uniqueKey' in $$props) $$invalidate('uniqueKey', uniqueKey = $$props.uniqueKey);
    		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
    	};

    	let idClip, idGradient;

    	$$self.$$.update = ($$dirty = { uniqueKey: 1 }) => {
    		if ($$dirty.uniqueKey) { $$invalidate('idClip', idClip = uniqueKey ? `${uniqueKey}-idClip` : uid()); }
    		if ($$dirty.uniqueKey) { $$invalidate('idGradient', idGradient = uniqueKey ? `${uniqueKey}-idGradient` : uid()); }
    	};

    	return {
    		preserveAspectRatio,
    		secondaryColor,
    		primaryColor,
    		secondaryOpacity,
    		primaryOpacity,
    		animate,
    		baseUrl,
    		height,
    		width,
    		speed,
    		uniqueKey,
    		idClip,
    		idGradient,
    		$$slots,
    		$$scope
    	};
    }

    class ContentLoader extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, ["preserveAspectRatio", "secondaryColor", "primaryColor", "secondaryOpacity", "primaryOpacity", "animate", "baseUrl", "height", "width", "speed", "uniqueKey"]);
    	}
    }

    /* src/BulletListLoader.svelte generated by Svelte v3.9.1 */

    // (2:0) <ContentLoader>
    function create_default_slot(ctx) {
    	var circle0, t0, rect0, t1, circle1, t2, rect1, t3, circle2, t4, rect2, t5, circle3, t6, rect3;

    	return {
    		c() {
    			circle0 = svg_element("circle");
    			t0 = space();
    			rect0 = svg_element("rect");
    			t1 = space();
    			circle1 = svg_element("circle");
    			t2 = space();
    			rect1 = svg_element("rect");
    			t3 = space();
    			circle2 = svg_element("circle");
    			t4 = space();
    			rect2 = svg_element("rect");
    			t5 = space();
    			circle3 = svg_element("circle");
    			t6 = space();
    			rect3 = svg_element("rect");
    			attr(circle0, "cx", "10");
    			attr(circle0, "cy", "20");
    			attr(circle0, "r", "8");
    			attr(rect0, "x", "25");
    			attr(rect0, "y", "15");
    			attr(rect0, "rx", "5");
    			attr(rect0, "ry", "5");
    			attr(rect0, "width", "220");
    			attr(rect0, "height", "10");
    			attr(circle1, "cx", "10");
    			attr(circle1, "cy", "50");
    			attr(circle1, "r", "8");
    			attr(rect1, "x", "25");
    			attr(rect1, "y", "45");
    			attr(rect1, "rx", "5");
    			attr(rect1, "ry", "5");
    			attr(rect1, "width", "220");
    			attr(rect1, "height", "10");
    			attr(circle2, "cx", "10");
    			attr(circle2, "cy", "80");
    			attr(circle2, "r", "8");
    			attr(rect2, "x", "25");
    			attr(rect2, "y", "75");
    			attr(rect2, "rx", "5");
    			attr(rect2, "ry", "5");
    			attr(rect2, "width", "220");
    			attr(rect2, "height", "10");
    			attr(circle3, "cx", "10");
    			attr(circle3, "cy", "110");
    			attr(circle3, "r", "8");
    			attr(rect3, "x", "25");
    			attr(rect3, "y", "105");
    			attr(rect3, "rx", "5");
    			attr(rect3, "ry", "5");
    			attr(rect3, "width", "220");
    			attr(rect3, "height", "10");
    		},

    		m(target, anchor) {
    			insert(target, circle0, anchor);
    			insert(target, t0, anchor);
    			insert(target, rect0, anchor);
    			insert(target, t1, anchor);
    			insert(target, circle1, anchor);
    			insert(target, t2, anchor);
    			insert(target, rect1, anchor);
    			insert(target, t3, anchor);
    			insert(target, circle2, anchor);
    			insert(target, t4, anchor);
    			insert(target, rect2, anchor);
    			insert(target, t5, anchor);
    			insert(target, circle3, anchor);
    			insert(target, t6, anchor);
    			insert(target, rect3, anchor);
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(circle0);
    				detach(t0);
    				detach(rect0);
    				detach(t1);
    				detach(circle1);
    				detach(t2);
    				detach(rect1);
    				detach(t3);
    				detach(circle2);
    				detach(t4);
    				detach(rect2);
    				detach(t5);
    				detach(circle3);
    				detach(t6);
    				detach(rect3);
    			}
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	var current;

    	var contentloader = new ContentLoader({
    		props: {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	}
    	});

    	return {
    		c() {
    			contentloader.$$.fragment.c();
    		},

    		m(target, anchor) {
    			mount_component(contentloader, target, anchor);
    			current = true;
    		},

    		p(changed, ctx) {
    			var contentloader_changes = {};
    			if (changed.$$scope) contentloader_changes.$$scope = { changed, ctx };
    			contentloader.$set(contentloader_changes);
    		},

    		i(local) {
    			if (current) return;
    			transition_in(contentloader.$$.fragment, local);

    			current = true;
    		},

    		o(local) {
    			transition_out(contentloader.$$.fragment, local);
    			current = false;
    		},

    		d(detaching) {
    			destroy_component(contentloader, detaching);
    		}
    	};
    }

    class BulletListLoader extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, []);
    	}
    }

    /* src/CodeLoader.svelte generated by Svelte v3.9.1 */

    // (2:0) <ContentLoader>
    function create_default_slot$1(ctx) {
    	var rect0, t0, rect1, t1, rect2, t2, rect3, t3, rect4, t4, rect5, t5, rect6, t6, rect7, t7, rect8;

    	return {
    		c() {
    			rect0 = svg_element("rect");
    			t0 = space();
    			rect1 = svg_element("rect");
    			t1 = space();
    			rect2 = svg_element("rect");
    			t2 = space();
    			rect3 = svg_element("rect");
    			t3 = space();
    			rect4 = svg_element("rect");
    			t4 = space();
    			rect5 = svg_element("rect");
    			t5 = space();
    			rect6 = svg_element("rect");
    			t6 = space();
    			rect7 = svg_element("rect");
    			t7 = space();
    			rect8 = svg_element("rect");
    			attr(rect0, "x", "0");
    			attr(rect0, "y", "0");
    			attr(rect0, "rx", "3");
    			attr(rect0, "ry", "3");
    			attr(rect0, "width", "70");
    			attr(rect0, "height", "10");
    			attr(rect1, "x", "80");
    			attr(rect1, "y", "0");
    			attr(rect1, "rx", "3");
    			attr(rect1, "ry", "3");
    			attr(rect1, "width", "100");
    			attr(rect1, "height", "10");
    			attr(rect2, "x", "190");
    			attr(rect2, "y", "0");
    			attr(rect2, "rx", "3");
    			attr(rect2, "ry", "3");
    			attr(rect2, "width", "10");
    			attr(rect2, "height", "10");
    			attr(rect3, "x", "15");
    			attr(rect3, "y", "20");
    			attr(rect3, "rx", "3");
    			attr(rect3, "ry", "3");
    			attr(rect3, "width", "130");
    			attr(rect3, "height", "10");
    			attr(rect4, "x", "155");
    			attr(rect4, "y", "20");
    			attr(rect4, "rx", "3");
    			attr(rect4, "ry", "3");
    			attr(rect4, "width", "130");
    			attr(rect4, "height", "10");
    			attr(rect5, "x", "15");
    			attr(rect5, "y", "40");
    			attr(rect5, "rx", "3");
    			attr(rect5, "ry", "3");
    			attr(rect5, "width", "90");
    			attr(rect5, "height", "10");
    			attr(rect6, "x", "115");
    			attr(rect6, "y", "40");
    			attr(rect6, "rx", "3");
    			attr(rect6, "ry", "3");
    			attr(rect6, "width", "60");
    			attr(rect6, "height", "10");
    			attr(rect7, "x", "185");
    			attr(rect7, "y", "40");
    			attr(rect7, "rx", "3");
    			attr(rect7, "ry", "3");
    			attr(rect7, "width", "60");
    			attr(rect7, "height", "10");
    			attr(rect8, "x", "0");
    			attr(rect8, "y", "60");
    			attr(rect8, "rx", "3");
    			attr(rect8, "ry", "3");
    			attr(rect8, "width", "30");
    			attr(rect8, "height", "10");
    		},

    		m(target, anchor) {
    			insert(target, rect0, anchor);
    			insert(target, t0, anchor);
    			insert(target, rect1, anchor);
    			insert(target, t1, anchor);
    			insert(target, rect2, anchor);
    			insert(target, t2, anchor);
    			insert(target, rect3, anchor);
    			insert(target, t3, anchor);
    			insert(target, rect4, anchor);
    			insert(target, t4, anchor);
    			insert(target, rect5, anchor);
    			insert(target, t5, anchor);
    			insert(target, rect6, anchor);
    			insert(target, t6, anchor);
    			insert(target, rect7, anchor);
    			insert(target, t7, anchor);
    			insert(target, rect8, anchor);
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(rect0);
    				detach(t0);
    				detach(rect1);
    				detach(t1);
    				detach(rect2);
    				detach(t2);
    				detach(rect3);
    				detach(t3);
    				detach(rect4);
    				detach(t4);
    				detach(rect5);
    				detach(t5);
    				detach(rect6);
    				detach(t6);
    				detach(rect7);
    				detach(t7);
    				detach(rect8);
    			}
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	var current;

    	var contentloader = new ContentLoader({
    		props: {
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	}
    	});

    	return {
    		c() {
    			contentloader.$$.fragment.c();
    		},

    		m(target, anchor) {
    			mount_component(contentloader, target, anchor);
    			current = true;
    		},

    		p(changed, ctx) {
    			var contentloader_changes = {};
    			if (changed.$$scope) contentloader_changes.$$scope = { changed, ctx };
    			contentloader.$set(contentloader_changes);
    		},

    		i(local) {
    			if (current) return;
    			transition_in(contentloader.$$.fragment, local);

    			current = true;
    		},

    		o(local) {
    			transition_out(contentloader.$$.fragment, local);
    			current = false;
    		},

    		d(detaching) {
    			destroy_component(contentloader, detaching);
    		}
    	};
    }

    class CodeLoader extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$2, safe_not_equal, []);
    	}
    }

    /* src/FacebookLoader.svelte generated by Svelte v3.9.1 */

    // (2:0) <ContentLoader>
    function create_default_slot$2(ctx) {
    	var rect0, t0, rect1, t1, rect2, t2, rect3, t3, rect4, t4, circle;

    	return {
    		c() {
    			rect0 = svg_element("rect");
    			t0 = space();
    			rect1 = svg_element("rect");
    			t1 = space();
    			rect2 = svg_element("rect");
    			t2 = space();
    			rect3 = svg_element("rect");
    			t3 = space();
    			rect4 = svg_element("rect");
    			t4 = space();
    			circle = svg_element("circle");
    			attr(rect0, "x", "70");
    			attr(rect0, "y", "15");
    			attr(rect0, "rx", "4");
    			attr(rect0, "ry", "4");
    			attr(rect0, "width", "117");
    			attr(rect0, "height", "6.4");
    			attr(rect1, "x", "70");
    			attr(rect1, "y", "35");
    			attr(rect1, "rx", "3");
    			attr(rect1, "ry", "3");
    			attr(rect1, "width", "85");
    			attr(rect1, "height", "6.4");
    			attr(rect2, "x", "0");
    			attr(rect2, "y", "80");
    			attr(rect2, "rx", "3");
    			attr(rect2, "ry", "3");
    			attr(rect2, "width", "350");
    			attr(rect2, "height", "6.4");
    			attr(rect3, "x", "0");
    			attr(rect3, "y", "100");
    			attr(rect3, "rx", "3");
    			attr(rect3, "ry", "3");
    			attr(rect3, "width", "380");
    			attr(rect3, "height", "6.4");
    			attr(rect4, "x", "0");
    			attr(rect4, "y", "120");
    			attr(rect4, "rx", "3");
    			attr(rect4, "ry", "3");
    			attr(rect4, "width", "201");
    			attr(rect4, "height", "6.4");
    			attr(circle, "cx", "30");
    			attr(circle, "cy", "30");
    			attr(circle, "r", "30");
    		},

    		m(target, anchor) {
    			insert(target, rect0, anchor);
    			insert(target, t0, anchor);
    			insert(target, rect1, anchor);
    			insert(target, t1, anchor);
    			insert(target, rect2, anchor);
    			insert(target, t2, anchor);
    			insert(target, rect3, anchor);
    			insert(target, t3, anchor);
    			insert(target, rect4, anchor);
    			insert(target, t4, anchor);
    			insert(target, circle, anchor);
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(rect0);
    				detach(t0);
    				detach(rect1);
    				detach(t1);
    				detach(rect2);
    				detach(t2);
    				detach(rect3);
    				detach(t3);
    				detach(rect4);
    				detach(t4);
    				detach(circle);
    			}
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	var current;

    	var contentloader = new ContentLoader({
    		props: {
    		$$slots: { default: [create_default_slot$2] },
    		$$scope: { ctx }
    	}
    	});

    	return {
    		c() {
    			contentloader.$$.fragment.c();
    		},

    		m(target, anchor) {
    			mount_component(contentloader, target, anchor);
    			current = true;
    		},

    		p(changed, ctx) {
    			var contentloader_changes = {};
    			if (changed.$$scope) contentloader_changes.$$scope = { changed, ctx };
    			contentloader.$set(contentloader_changes);
    		},

    		i(local) {
    			if (current) return;
    			transition_in(contentloader.$$.fragment, local);

    			current = true;
    		},

    		o(local) {
    			transition_out(contentloader.$$.fragment, local);
    			current = false;
    		},

    		d(detaching) {
    			destroy_component(contentloader, detaching);
    		}
    	};
    }

    class FacebookLoader extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$3, safe_not_equal, []);
    	}
    }

    /* src/ListLoader.svelte generated by Svelte v3.9.1 */

    // (2:0) <ContentLoader>
    function create_default_slot$3(ctx) {
    	var rect0, t0, rect1, t1, rect2, t2, rect3, t3, rect4, t4, rect5;

    	return {
    		c() {
    			rect0 = svg_element("rect");
    			t0 = space();
    			rect1 = svg_element("rect");
    			t1 = space();
    			rect2 = svg_element("rect");
    			t2 = space();
    			rect3 = svg_element("rect");
    			t3 = space();
    			rect4 = svg_element("rect");
    			t4 = space();
    			rect5 = svg_element("rect");
    			attr(rect0, "x", "0");
    			attr(rect0, "y", "0");
    			attr(rect0, "rx", "3");
    			attr(rect0, "ry", "3");
    			attr(rect0, "width", "250");
    			attr(rect0, "height", "10");
    			attr(rect1, "x", "20");
    			attr(rect1, "y", "20");
    			attr(rect1, "rx", "3");
    			attr(rect1, "ry", "3");
    			attr(rect1, "width", "220");
    			attr(rect1, "height", "10");
    			attr(rect2, "x", "20");
    			attr(rect2, "y", "40");
    			attr(rect2, "rx", "3");
    			attr(rect2, "ry", "3");
    			attr(rect2, "width", "170");
    			attr(rect2, "height", "10");
    			attr(rect3, "x", "0");
    			attr(rect3, "y", "60");
    			attr(rect3, "rx", "3");
    			attr(rect3, "ry", "3");
    			attr(rect3, "width", "250");
    			attr(rect3, "height", "10");
    			attr(rect4, "x", "20");
    			attr(rect4, "y", "80");
    			attr(rect4, "rx", "3");
    			attr(rect4, "ry", "3");
    			attr(rect4, "width", "200");
    			attr(rect4, "height", "10");
    			attr(rect5, "x", "20");
    			attr(rect5, "y", "100");
    			attr(rect5, "rx", "3");
    			attr(rect5, "ry", "3");
    			attr(rect5, "width", "80");
    			attr(rect5, "height", "10");
    		},

    		m(target, anchor) {
    			insert(target, rect0, anchor);
    			insert(target, t0, anchor);
    			insert(target, rect1, anchor);
    			insert(target, t1, anchor);
    			insert(target, rect2, anchor);
    			insert(target, t2, anchor);
    			insert(target, rect3, anchor);
    			insert(target, t3, anchor);
    			insert(target, rect4, anchor);
    			insert(target, t4, anchor);
    			insert(target, rect5, anchor);
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(rect0);
    				detach(t0);
    				detach(rect1);
    				detach(t1);
    				detach(rect2);
    				detach(t2);
    				detach(rect3);
    				detach(t3);
    				detach(rect4);
    				detach(t4);
    				detach(rect5);
    			}
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	var current;

    	var contentloader = new ContentLoader({
    		props: {
    		$$slots: { default: [create_default_slot$3] },
    		$$scope: { ctx }
    	}
    	});

    	return {
    		c() {
    			contentloader.$$.fragment.c();
    		},

    		m(target, anchor) {
    			mount_component(contentloader, target, anchor);
    			current = true;
    		},

    		p(changed, ctx) {
    			var contentloader_changes = {};
    			if (changed.$$scope) contentloader_changes.$$scope = { changed, ctx };
    			contentloader.$set(contentloader_changes);
    		},

    		i(local) {
    			if (current) return;
    			transition_in(contentloader.$$.fragment, local);

    			current = true;
    		},

    		o(local) {
    			transition_out(contentloader.$$.fragment, local);
    			current = false;
    		},

    		d(detaching) {
    			destroy_component(contentloader, detaching);
    		}
    	};
    }

    class ListLoader extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$4, safe_not_equal, []);
    	}
    }

    /* src/InstagramLoader.svelte generated by Svelte v3.9.1 */

    // (2:0) <ContentLoader height={480}>
    function create_default_slot$4(ctx) {
    	var circle, t0, rect0, t1, rect1, t2, rect2;

    	return {
    		c() {
    			circle = svg_element("circle");
    			t0 = space();
    			rect0 = svg_element("rect");
    			t1 = space();
    			rect1 = svg_element("rect");
    			t2 = space();
    			rect2 = svg_element("rect");
    			attr(circle, "cx", "30");
    			attr(circle, "cy", "30");
    			attr(circle, "r", "30");
    			attr(rect0, "x", "75");
    			attr(rect0, "y", "13");
    			attr(rect0, "rx", "4");
    			attr(rect0, "ry", "4");
    			attr(rect0, "width", "100");
    			attr(rect0, "height", "13");
    			attr(rect1, "x", "75");
    			attr(rect1, "y", "37");
    			attr(rect1, "rx", "4");
    			attr(rect1, "ry", "4");
    			attr(rect1, "width", "50");
    			attr(rect1, "height", "8");
    			attr(rect2, "x", "0");
    			attr(rect2, "y", "70");
    			attr(rect2, "rx", "5");
    			attr(rect2, "ry", "5");
    			attr(rect2, "width", "400");
    			attr(rect2, "height", "400");
    		},

    		m(target, anchor) {
    			insert(target, circle, anchor);
    			insert(target, t0, anchor);
    			insert(target, rect0, anchor);
    			insert(target, t1, anchor);
    			insert(target, rect1, anchor);
    			insert(target, t2, anchor);
    			insert(target, rect2, anchor);
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(circle);
    				detach(t0);
    				detach(rect0);
    				detach(t1);
    				detach(rect1);
    				detach(t2);
    				detach(rect2);
    			}
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	var current;

    	var contentloader = new ContentLoader({
    		props: {
    		height: 480,
    		$$slots: { default: [create_default_slot$4] },
    		$$scope: { ctx }
    	}
    	});

    	return {
    		c() {
    			contentloader.$$.fragment.c();
    		},

    		m(target, anchor) {
    			mount_component(contentloader, target, anchor);
    			current = true;
    		},

    		p(changed, ctx) {
    			var contentloader_changes = {};
    			if (changed.$$scope) contentloader_changes.$$scope = { changed, ctx };
    			contentloader.$set(contentloader_changes);
    		},

    		i(local) {
    			if (current) return;
    			transition_in(contentloader.$$.fragment, local);

    			current = true;
    		},

    		o(local) {
    			transition_out(contentloader.$$.fragment, local);
    			current = false;
    		},

    		d(detaching) {
    			destroy_component(contentloader, detaching);
    		}
    	};
    }

    class InstagramLoader extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$5, safe_not_equal, []);
    	}
    }

    exports.BulletListLoader = BulletListLoader;
    exports.CodeLoader = CodeLoader;
    exports.FacebookLoader = FacebookLoader;
    exports.InstagramLoader = InstagramLoader;
    exports.ListLoader = ListLoader;
    exports.default = ContentLoader;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
