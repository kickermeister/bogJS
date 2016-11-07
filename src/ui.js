/**
 * @file ui.js
 * @author Michael Weitnauer [weitnauer@irt.de]
 */

/**
 * @module bogJS
 */

//var log = require('loglevel');
//var _ = require('underscore');
window.$ = require('jquery');
require('jquery-ui-browserify');
//require('jquery-ui/ui/widgets/mouse');
//require('jquery-ui/ui/widgets/draggable');
require('jquery-mousewheel')($);
require('jquery.transit');
//var ObjectManager = require('./object_manager');

/**
 * The UIManager offers some functionality for a classic 2D user interface. Is
 * is intended to be heavily improved and abstracted in the future to meet
 * requirements of other and general user interfaces.
 *
 * @constructor
 *
 * @param {ObjectManager} [om=ObjectManager] - instance of [ObjectManager]{@link
 * module:bogJS~ObjectManager} instance
 * @param {String} url - URL to scene file. If no ObjectManager instance is
 * passed, the URL must be passed.
 * @param {number} [loglevel=1] - logging level
 */
var UIManager = function(om, url, loglevel){
    var loglevel = loglevel || log.levels.DEBUG;
    log.setLevel(loglevel);
    this.om = om || new ObjectManager(url);
    this.bg = "";
    this.listener = "";
    this.btn_togglePanning = "";
    this.btn_toggleInteractive = "";
    this._resizeFactor = 50;
    this._iconsize = 32;
    this.roomsize = [500, 500];
    this._interactive = false;
    this._interval = 0.1;
    this._soloed = false;

    this._enableEventListener();
}

UIManager.prototype = {

    /**
     * Starts the [ObjectManager]{@link module:bogJS~ObjectManager} and the
     * UIManager if the needed ressources are already loaded and decoded.
     *
     * @returns {Boolean} state - If ObjectManager not yet ready, false will
     * be returned.
     */
    start: function(){
        if (this.om.start() == true) {
            var roomsize = [this.om.roomDimensions[0] * this._resizeFactor, this.om.roomDimensions[1] * this._resizeFactor];
            this._setRoomSize(roomsize);
            this._setListenerPosition([this.om._listenerPosition[0], 
                                      this.om._listenerPosition[1]]);
            this._addObjects();
            var that = this;
            if (!this._interactive){
                this._disableInteractive();
            }
            $(this.btn_togglePanning).click(function(){
                that.om.togglePanningType();
                $(this).find('img').toggle();
            });
            $(this.btn_toggleInteractive).click(function(){
                that.toggleInteractive();
                $(this).find('img').toggle();
            });
            $(this.listener).mousewheel(function(event, delta){
                var angle = that._xyz2angle(that.om.getListenerOrientation());
                if(delta < 0) {
                    var new_angle = angle - 5;
                } else {
                    var new_angle = angle + 5;
                }
                that._setListenerOrientation(new_angle);
                $('.irt_listener').css({rotate: new_angle});
                return false;         // this will prevent window scrolling 
            });
            return true;
        } else {
            var that = this;
            console.log("Object manager not yet ready.. waiting..");
        }
    },

    /**
     * Stops UIManager and ObjectManager
     *
     */
    stop: function(){
        this.om.stop();
        this._removeObjects();
        $(this.btn_togglePanning).unbind();
        $(this.btn_toggleInteractive).unbind();
        return true;
    },

    /**
     * Enables / disables the interactive mode of the UI.
     * If interactive mode is enabled, all changes (position, gain, ..) will
     * be ignored. Interactivity is offered for positions and soloing of
     * objects so far.
     */
    toggleInteractive: function(){
        if (this._interactive == false){
            this._enableInteractive();    
        }
        else if (this._interactive == true){
            this._disableInteractive();
        }
    },
    
    /**
     * Enables the device orientation for rotation on mobiles. Is rather 
     * untested and may be improved in the future.
     *
     */
    enableDeviceOrientation: function(){
        var that = this;
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', function(eventData) {
                var dir = -1 * Math.round(eventData.alpha);
                that._setListenerOrientation(dir);
                $(this.listener).css({rotate: dir});
            }, false);
        } else {
            log.info("Not supported on your device or browser.  Sorry.");
        }
    },
     
    _enableEventListener: function(){
        $(this.om).on('om_newPosition', function(e, obj, pos){
            this._changeUIObjectPosition(obj, [pos[0], -1 * pos[2]]);
        }.bind(this));
        
        $(this.om).on('om_isActive', function(e, obj, bool){
            this._displayObject(obj, bool);
        }.bind(this));

    },
  
    _displayObject: function(obj, bool){
        if (bool){
            $("#" + obj).show();
        } else{
             $("#" + obj).hide();
        }
        log.debug("Setting state of object " + obj + ' to ' + bool);
    },

    _enableInteractive: function(){
        for (key in this.om.objects){
            $("#"+key).draggable('enable');
            $("#"+key).hover(function() {
                $(this).css("cursor","move");
            });
        }
        this._enableSolo();
        $(this.om).off('om_newPosition');
        $(this.om).off('om_isActive');
        this._interactive = true;
        this.om.interactive = true;
    },

    _disableInteractive: function(){
        for (key in this.om.objects){
            $("#"+key).draggable('disable');
            $("#"+key).off('dblclick');
            $("#"+key).hover(function() {
                $(this).css("cursor","auto");
            });
        }
        this._enableEventListener();
        this._interactive = false;
        this.om.interactive = false;
    },

    _enableSolo: function(){
        var that = this;
        for (var key in this.om.objects){
            $("#"+key).dblclick(function(event, ui){
                if (that._soloed !== event.target.id){
                    for (var key in that.om.objects){
                        log.debug("Muting " + key);
                        $("#"+key).addClass("irt_object_disabled")
                        that.om.objects[key].setStatus(false);
                    }
                    $("#"+event.target.id).removeClass("irt_object_disabled")
                    log.debug("Unmuting " + event.target.id);
                    that.om.objects[event.target.id].setStatus(true);
                    that._soloed = event.target.id;
                } else {
                    for (var key in that.om.objects){
                        log.debug("Unmuting " + key);
                        $("#"+key).removeClass("irt_object_disabled")
                        that.om.objects[key].setStatus(true);
                    }
                    that._soloed = false;
                }
            });
        }
    },

    _addObjects: function(){
        for (key in this.om.objects){
            $(this.bg).append("<div class='irt_object' id='" + key + "'></div>");
            $("#"+key).append("<p class='irt_object_title'>" + key + "</p>");

            var pos = this.om.objects[key].getPosition();
            this._changeUIObjectPosition(key, [pos[0], -1 * pos[2]]);
            var that = this;
            $("#"+key).draggable({
                drag: _.throttle(
                    function(event, ui){
                        var topleft = [ui.position.top, ui.position.left];
                        var xy = that._topleft2xy(topleft);
                        that.om.objects[event.target.id].setPosition([xy[0], 0, -1 * xy[1]]);
                        log.debug("Drag event position: " + topleft);
                    }
                , 50)    
            });
            if (!this.om.objects[key].getStatus()){
                this._displayObject(key, false);
            }
        }
    },

    _removeObjects: function(){
        for (key in this.om.objects){
            $("#"+key).remove();
        }
    },

    _setRoomSize: function(roomsize) {
        $(this.bg).css({"width": roomsize[0], "height": roomsize[1]});
        this.roomsize = roomsize;
    },

    _setListenerPosition: function(xy) {
        var topleft = this._xy2topleft(xy);
        $(this.listener).css({"top": topleft[0], "left": topleft[1]});
        log.info("New listener position: " + topleft);
        var that = this;
        $(this.listener).draggable({
            drag: function(event, ui){
                var topleft = [ui.position.top, ui.position.left];
                var xy = that._topleft2xy(topleft);
                that.om.setListenerPosition(xy[0], xy[1], 0);
            }
        });
    },

    _setListenerOrientation: function (angle){
        // As x and y are somehow flipped, x needs to be calculated with sinus
        // and not with cosinus.. TODO: check why !?
        //var x = 32 * Math.sin(angle * (Math.PI / 180));
        //var y = 32 * Math.cos(angle * (Math.PI / 180));
        var x = 10 * Math.sin(angle * (Math.PI / 180));
        var y = 0;  // as we don't have a lattitude here y is always 0 :)
        var z = -10 * Math.cos(angle * (Math.PI / 180));

        log.info("Set angle " + angle + " to new listener orientation " + x + " " + y + " " + z);
        this.om.setListenerOrientation(x, y, z);
    },

    _changeUIObjectPosition: function(id, xy) {
        var topleft = this._xy2topleft(xy);
        $("#"+id).css({"top": topleft[0], "left": topleft[1]});
        log.debug("New position of " + id + " is: " + topleft + "(xy: " + xy + ")");
    },

    _setObjPos: function(id, topleft){
        var xy = this._topleft2xy(topleft);
        var xyz = [xy[0], xy[1], 0];
        this.om.objects[id].setPostion(xyz);
    },

    _xy2topleft: function(xy){
        var topleft = [(-xy[1] * this._resizeFactor) + this.roomsize[1] / 2,
                       (xy[0] * this._resizeFactor) + this.roomsize[0] / 2];
        return topleft;
    },

    _topleft2xy: function(topleft){
        var xy = [-(this.roomsize[1] / 2 - topleft[1]) / this._resizeFactor, 
                  (this.roomsize[0] / 2 - topleft[0]) / this._resizeFactor];
        return xy;
    },

    _angle2xy: function(angle){
        // For some reason, x needs to be calculated with sinus
        // and not with cosinus.. TODO: check why !?
        var x = 10 * Math.sin(angle * (Math.PI / 180));
        var y = 0;
        var z = -10 * Math.cos(angle * (Math.PI / 180));
        return [x, z];
    },

    _xyz2angle: function(xyz){
        var angle = Math.atan2(xyz[0], -xyz[2]) / Math.PI * 180;
        return angle;
    }
}

module.exports = UIManager;
