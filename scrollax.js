/**
 * Polyfill for requestAnimationFrame from https://gist.github.com/paulirish/1579671
 */
(function () {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame']
            || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function (callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function () {
                    callback(currTime + timeToCall);
                },
                timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };
}());

/**
 * Scrollax v0.2.0
 * JavaScript scroll event animation engine
 */
(function (root, factory) {
    root.scrollax = factory();
}(this, function () {
    var version = '0.2.0';

    var default_options = {
        offset: {
            start: 0,
            end: 1
        },
        relative: 'self', //Valid options are self, parent, or page
        translateX: null,
        translateY: null,
        translateZ: null,
        rotateX: null,
        rotateY: null,
        rotateZ: null,
        scale: null,
        opacity: null
    }

    var animatable_items = [];
    var last_scroll = 0;
    var is_animating = false;

    var is = (function () {
        return {
            array: function (a) {
                return Array.isArray(a)
            },
            object: function (a) {
                return Object.prototype.toString.call(a).indexOf('Object') > -1
            },
            svg: function (a) {
                return a instanceof SVGElement
            },
            dom: function (a) {
                return a.nodeType || is.svg(a)
            },
            number: function (a) {
                return !isNaN(parseInt(a))
            },
            string: function (a) {
                return typeof a === 'string'
            },
            func: function (a) {
                return typeof a === 'function'
            },
            undef: function (a) {
                return (typeof a === 'undefined' || a === 'undefined')
            },
            null: function (a) {
                return (typeof a === 'null' || a === null);
            },
            hex: function (a) {
                return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(a)
            },
            rgb: function (a) {
                return /^rgb/.test(a)
            },
            rgba: function (a) {
                return /^rgba/.test(a)
            },
            hsl: function (a) {
                return /^hsl/.test(a)
            },
            color: function (a) {
                return (is.hex(a) || is.rgb(a) || is.rgba(a) || is.hsl(a))
            },
            dom_class: function (a) {
                return a.indexOf('.') !== -1;
            },
            dom_id: function (a) {
                return a.indexOf('#') !== -1;
            }
        }
    })();

    /**
     * Examines the target and returns an array of matching dom elements
     * @param {string} target - The target elements to look for.
     */
    function get_target(target) {
        if (is.dom_class(target)) {
            return document.getElementsByClassName(target.substring(1));
        }
        else if (is.dom_id(target)) {
            return [document.getElementById(target.substring(1))];
        }
        else {
            return document.getElementsByTagName(target);
        }
    }

    /**
     * Creates an animatable item with the given options and adds it to the animatable_items array.
     * @param {object} params - The options for creating an animatable option.
     */
    function create_animatable_items(params) {
        var items = get_target(params.target);
        for (var i = 0; i < items.length; i++) {
            if (!is.undef(items[i]) && !is.null(items[i])) {
                var initial_top;
                switch (params.relative) {
                    case 'self':
                        initial_top = items[i].getBoundingClientRect().top + window.scrollY;
                        break;
                    case 'parent':
                        initial_top = items[i].parentElement.getBoundingClientRect().top + window.scrollY;
                        break;
                    default:
                        initial_top = window.scrollY;
                }
                params.el = {
                    self: items[i],
                    parent: items[i].parentElement,
                    initialTop: initial_top
                };
                animatable_items.push(animatable_item(params));
            }
        }
        return animatable_items;
    }

    /**
     * Iterates through the animatable_items array and calls the animate function for each item.
     * @param {number} scroll_value - The current scrollY position of the page. The animations will be based on this value.
     */
    function update_animations(scroll_value) {
        for (var i = 0; i < animatable_items.length; i++) {
            animatable_items[i].animate(scroll_value);
        }
    }

    /**
     * Takes the user defined options and merges them with the default options.
     * @param {object} options - The user defined options.
     * @param {object} default_ops - The default options.
     */
    function merge_animation_options(options, default_ops) {
        var merged_options = {};
        for (var option in default_ops) {
            if (options.hasOwnProperty(option)) {
                if(option === "relative") {
                    merged_options[option] = options[option];
                }
                else if(is.number(options[option])) {
                    merged_options[option] = {start: 0, end: options[option]}
                }
                else {
                    merged_options[option] = options[option];
                }
            } else {
                merged_options[option] = default_ops[option];
            }
        }
        merged_options['target'] = options['target'];
        return merged_options;
    }

    /**
     * Copies the given values and returns them to create an animatable_item.
     * @param {object} options - The animatable_item options.
     */
    function copy_animatable_item_options(options) {
        var merged_options = {};
        for (var option in options) {
            if (options.hasOwnProperty(option)) {
                merged_options[option] = options[option];
            }
        }
        return merged_options;
    }

    function get_value_in_range(value, start, end) {
        var least = start;
        var greatest = end;
        if(least > greatest) {
            least = end;
            greatest = start;
        }
        if(value > greatest) {
            return greatest;
        }
        else if( value < least) {
            return least;
        }
        else {
            return value;
        }

    }

    /**
     * Takes the relative scroll value and the animatable_item and changes the value of the opacity.
     * @param {number} rsv - The relative scroll value of the page.
     * @param {object} ai - The animatable_item being animated.
     */
    function animate_opacity(rsv, ai) {
        var opacity_direction = ai.opacity.end - ai.opacity.start;
        return ai.el.self.style.opacity = get_value_in_range(ai.opacity.start + (rsv / ((ai.offset.end - ai.offset.start) * window.innerHeight)) * opacity_direction, ai.opacity.start, ai.opacity.end);
    }

    //Disabled
    /**
     * Takes the relative scroll value and the animatable_item and changes the value of the background position.
     * @param {number} rsv - The relative scroll value of the page.
     * @param {object} ai - The animatable_item being animated.
     */
    function animate_background_position(rsv, ai) {
        var backgroundposition_string = '';
        if (is.array(ai.backgroundPosition) && ai.backgroundPosition.length == 2) {
            var xCoord, yCoord = 0;
            if(is.number(ai.backgroundPosition[0])) {
                xCoord = rsv * ai.backgroundPosition[0] + "px";
            }
            else {
                xCoord = ai.backgroundPosition[0];
            }
            if(is.number(ai.backgroundPosition[1])) {
                yCoord = rsv * ai.backgroundPosition[1] + "px";
            }
            else {
                yCoord = ai.backgroundPosition[1];
            }
            backgroundposition_string = xCoord + " " + yCoord;
        }
        else if (is.number(ai.backgroundPosition)) {
            backgroundposition_string = "center " + rsv * ai.backgroundPosition + "px";
        }

        return ai.el.self.style.backgroundPosition = backgroundposition_string;
    }

    /**
     * Takes the relative scroll value and the animatable_item and changes the value of the transform.
     * @param {number} rsv - The relative scroll value of the page.
     * @param {object} ai - The animatable_item being animated.
     */
    function animate_transform(rsv, ai) {
        var transform_string = ai.el.self.style.transform;

        if (!is.null(ai.translateX)) {
            var translateX_direction = ai.translateX.end - ai.translateX.start;
            var tX = get_value_in_range(ai.translateX.start + (rsv / ((ai.offset.end - ai.offset.start) * window.innerHeight)) * translateX_direction, ai.translateX.start, ai.translateX.end);
            if(transform_string.indexOf('translateX') !== -1) {
                transform_string = transform_string.replace(/translateX\(.*?\)/, "translateX("+tX+"px)");
            }
            else {
                transform_string += "translateX(" + tX + "px) ";
            }
        }
        if (!is.null(ai.translateY)) {
            var translateY_direction = ai.translateY.end - ai.translateY.start;
            var tY = get_value_in_range(ai.translateY.start + (rsv / ((ai.offset.end - ai.offset.start) * window.innerHeight)) * translateY_direction, ai.translateY.start, ai.translateY.end);
            if(transform_string.indexOf('translateY') !== -1) {
                transform_string = transform_string.replace(/translateY\(.*?\)/, "translateY("+tY+"px)");
            }
            else {
                transform_string += "translateY(" + tY + "px) ";
            }
        }
        if (!is.null(ai.translateZ)) {
            var translateZ_direction = ai.translateZ.end - ai.translateZ.start;
            var tZ = get_value_in_range(ai.translateZ.start + (rsv / ((ai.offset.end - ai.offset.start) * window.innerHeight)) * translateZ_direction, ai.translateZ.start, ai.translateZ.end);
            if(transform_string.indexOf('translateZ') !== -1) {
                transform_string = transform_string.replace(/translateZ\(.*?\)/, "translateZ("+tZ+"px)");
            }
            else {
                transform_string += "translateZ(" + tZ + "px) ";
            }
        }
        if (!is.null(ai.rotateX)) {
            var rotateX_direction = ai.rotateX.end - ai.rotateX.start;
            var dX = get_value_in_range(ai.rotateX.start + (rsv / ((ai.offset.end - ai.offset.start) * window.innerHeight)) * rotateX_direction, ai.rotateX.start, ai.rotateX.end);
            if(transform_string.indexOf('rotateX') !== -1) {
                transform_string = transform_string.replace(/rotateX\(.*?\)/, "rotateX("+dX+"deg)");
            }
            else {
                transform_string += "rotateX(" + dX + "deg) ";
            }
        }
        if (!is.null(ai.rotateY)) {
            var rotateY_direction = ai.rotateY.end - ai.rotateY.start;
            var dY = get_value_in_range(ai.rotateY.start + (rsv / ((ai.offset.end - ai.offset.start) * window.innerHeight)) * rotateY_direction, ai.rotateY.start, ai.rotateY.end);
            if(transform_string.indexOf('rotateY') !== -1) {
                transform_string = transform_string.replace(/rotateY\(.*?\)/, "rotateY("+dY+"deg)");
            }
            else {
                transform_string += "rotateY(" + dY + "deg) ";
            }
        }
        if (!is.null(ai.rotateZ)) {
            var rotateZ_direction = ai.rotateZ.end - ai.rotateZ.start;
            var dZ = get_value_in_range(ai.rotateZ.start + (rsv / ((ai.offset.end - ai.offset.start) * window.innerHeight)) * rotateZ_direction, ai.rotateZ.start, ai.rotateZ.end);
            if(transform_string.indexOf('rotateZ') !== -1) {
                transform_string = transform_string.replace(/rotateZ\(.*?\)/, "rotateZ("+dZ+"deg)");
            }
            else {
                transform_string += "rotateZ(" + dZ + "deg) ";
            }
        }
        if (!is.null(ai.scale)) {

            var scale_direction = ai.scale.end - ai.scale.start;
            var scale = get_value_in_range(ai.scale.start + (rsv / ((ai.offset.end - ai.offset.start) * window.innerHeight)) * scale_direction, ai.scale.start, ai.scale.end);

            if(transform_string.indexOf('scale') !== -1) {
                transform_string = transform_string.replace(/scale\(.*?\)/, "scale("+scale+")");
            }
            else {
                transform_string += "scale(" + scale + ") ";
            }
        }
        return ai.el.self.style.transform = transform_string;
    }

    var animatable_item = function (params) {
        var item = copy_animatable_item_options(params);
        /**
         * Returns the offset of the (item or parent) to the top of the window.
         */
        item.top = function () {
            var animating_item = this;
            switch (animating_item.relative) {
                case 'self':
                    return item.el.self.getBoundingClientRect().top;
                case 'parent':
                    return item.el.parent.getBoundingClientRect().top;
                default:
                    return 0;
            }
        };

        /**
         * Returns true if any part of the (item or parent) is in the viewport
         */
        item.is_viewable = function () {
            var animating_item = this;
            var rect;
            if (animating_item.relative === "parent") {
                rect = animating_item.el.parent.getBoundingClientRect();
            }
            else {
                rect = animating_item.el.self.getBoundingClientRect();
            }
            return (
                rect.bottom >= 0 &&
                (rect.top <= (window.innerHeight || document.documentElement.clientHeight) ||
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight))
            );
        };

        /**
         * Runs all of the animations in the animation_queue based off of the current scrollY of the page.
         * @param {number} current_scroll_value - The current scrollY of the page.
         */
        item.animate = function (current_scroll_value) {
            var animating_item = this;
            var relative_scroll_value = Math.max(0, (current_scroll_value + document.documentElement.offsetTop + window.innerHeight) - (animating_item.el.initialTop + (animating_item.offset.start * window.innerHeight)));

            if (relative_scroll_value <= animating_item.offset.end * window.innerHeight) {
                animating_item.animation_queue.forEach(function (animation_function) {
                    animation_function(relative_scroll_value, animating_item);
                });
            }
        };




        /**
         * The array that stores all of the animations assigned to an animatable_item.
         */
        item.animation_queue = [];

        /**
         * Checks the values of an item and queues up the relevant animations.
         */
        item.queue_animations = function() {
            var animating_item = this;
            if(!is.null(animating_item.opacity)) {
                animating_item.animation_queue.push(animate_opacity);
            }
            if(!is.null(animating_item.backgroundPosition)) {
                animating_item.animation_queue.push(animate_background_position);
            }
            if(!is.null(animating_item.translateX) || !is.null(animating_item.translateY) || !is.null(animating_item.translateZ) || !is.null(animating_item.rotateX) || !is.null(animating_item.rotateY) || !is.null(animating_item.rotateZ) || !is.null(animating_item.scale)) {
                animating_item.animation_queue.push(animate_transform);
            }
        };
        // disabled for now.
        item.setBackgroundSize = function() {
            var animating_item = this;
            if(animating_item.forceBackgroundSize && animating_item.backgroundPosition !== 0) {
                animating_item.el.self.style.backgroundSize = "auto " + (100 + Math.abs(animating_item.backgroundPosition * 100)) + "%";
            }
        }
        item.queue_animations();
        //item.setBackgroundSize();
        item.animate(window.scrollY); //call once at the beginning to initialize values
        return item;
    };

    /**
     * Holds all the information for our animatable_items.
     */
    var animation_controller = function (params) {
        var ac = {};
        var animation_options = merge_animation_options(params, default_options);
        ac.animatable_items = create_animatable_items(animation_options);
        return ac;
    };

    /**
     * The scroll event listener. Uses requestAnimationFrame for ideal performance.
     */
    window.addEventListener('scroll', function () {
        last_scroll = window.scrollY;
        if (!is_animating) {
            window.requestAnimationFrame(function () {
                update_animations(last_scroll);
                is_animating = false;
            });
        }
        is_animating = true;
    });

    animation_controller.animatable_items = animatable_items;
    animation_controller.version = version;
    return animation_controller;
}));