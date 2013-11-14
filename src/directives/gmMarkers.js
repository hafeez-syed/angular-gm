/**
 * @ngdoc directive
 * @name angulargm.directive:gmMarkers
 * @element ANY
 *
 * @description
 * A directive for adding markers to a `gmMap`. You may have multiple per `gmMap`.
 *
 * To use, you specify an array of custom objects and tell the directive how to
 * extract an id and position from them. A marker will be created for each of
 * your objects. If you assign a new array to your scope variable or change the
 * array's length, the markers will also update.
 *
 * Only the `gm-objects`, `gm-id` and `gm-position` attributes are required.
 *
 * @param {expression} gm-objects an array of objects in the current scope.
 * These can be any objects you wish to attach to markers, the only requirement
 * is that they have a uniform method of accessing an id and a position.
 *
 *
 * @param {expression} gm-id an angular expression that given an object from
 * `gm-objects`, evaluates to a unique identifier for that object. Your object
 * can be accessed through the variable `object`. See `gm-position` below for
 * an example.
 *
 * @param {expression} gm-position an angular expression that given an object from
 * `gm-objects`, evaluates to an object with lat and lng properties. Your
 * object can be accessed through the variable `object`.  For example, if
 * your controller has
 * ```js
 * ...
 * $scope.myObjects = [
 *   { id: 0, location: { lat: 5, lng: 5} }, 
 *   { id: 1, location: { lat: 6, lng: 6} }
 * ]
 * ...
 * ```
 * then in the `gm-markers` directive you would put
 * ```js
 * ...
 * gm-objects="myObjects"
 * gm-id="object.id"
 * gm-position="{ lat: object.location.lat, lng: object.location.lng }"
 * ...
 * ```
 *
 *
 * @param {expression} gm-marker-options an angular expression that given
 * an object from `gm-objects`, evaluates to a
 * [google.maps.MarkerOptions](https://developers.google.com/maps/documentation/javascript/reference#MarkerOptions)
 * object.  Your object can be accessed through the variable `object`. If
 * unspecified, google maps api defaults will be used.
 *
 *
 * @param {expression} gm-events a variable in the current scope that is used to
 * simulate events on markers. Setting this variable to an object of the form 
 * ```js
 *     [
 *       {
 *         event: 'click',
 *         ids: [id1, ...]
 *       },
 *       ...
 *     ]
 * ```
 * will generate the named events on the markers with the given ids, if a
 * marker with each id exists. Note: when setting the `gm-events` variable, you
 * must set it to a new object for the changes to be detected.  Code like
 * ```js
 * myEvents[0]["ids"] = [0]
 * ``` 
 * will not work.
 *                      
 *
 * @param {expression} gm-on-*event* an angular expression which evaluates to
 * an event handler. This handler will be attached to each marker's \*event\*
 * event.  The variables 'object' and 'marker' evaluate to your object and the
 * [google.maps.Marker](https://developers.google.com/maps/documentation/javascript/reference#Marker),
 * respectively. For example: 
 * ```html
 * gm-on-click="myClickFn(object, marker)"
 * ```
 * will call your `myClickFn` whenever a marker is clicked.  You may have
 * multiple `gm-on-*event*` handlers, but only one for each type of event.
 * For events that have an underscore in their name, such as
 * 'position_changed', write it as 'gm-on-position-changed'.
 */

/**
 * @ngdoc event
 * @name angulargm.directive:gmMarkers#gmMarkersRedraw
 * @eventOf angulargm.directive:gmMarkers
 * @eventType listen on current gmMarkers scope
 *
 * @description Force the gmMarkers directive to clear and redraw all markers.
 *
 * @param {string} objects Not required. The name of the scope variable which
 * holds the objects to redraw markers for, i.e. what you set `gm-objects` to.
 * It is useful because there may be multiple instances of the `gmMarkers`
 * directive. If not specified, all instances of gmMarkers which are child
 * scopes will redraw their markers.
 *
 * @example
 * ```js
 * $scope.$broadcast('gmMarkersRedraw', 'myObjects');
 * ```
 */
 
/**
 * @ngdoc event
 * @name angulargm.directive:gmMarkers#gmMarkersUpdated
 * @eventOf angulargm.directive:gmMarkers
 * @eventType emit on current gmMarkers scope
 * 
 * @description Emitted when markers are updated.
 *
 * @param {string} objects the name of the scope variable which holds the
 * objects the gmMarkers directive was constructed with. This is what
 * `gm-objects` was set to.
 *
 * @example
 * ```js
 * $scope.$on('gmMarkersUpdated', function(event, objects) {
 *     if (objects === 'myObjects') {
 *       ...
 *     }
 * });
 * ```
 */

(function () {
'use strict';

  angular.module('AngularGM').

  directive('gmMarkers', ['$log', '$parse', '$timeout', 'angulargmUtils', 
    function($log, $parse, $timeout, angulargmUtils) {

    /** aliases */
    var latLngEqual = angulargmUtils.latLngEqual;
    var objToLatLng = angulargmUtils.objToLatLng;
    var getEventHandlers = angulargmUtils.getEventHandlers;
    var createHash = angulargmUtils.createHash;


    function link(scope, element, attrs, controller) {
      // check attrs
      if (!('gmObjects' in attrs)) {
        throw 'gmObjects attribute required';
      } else if (!('gmId' in attrs)) {
        throw 'gmId attribute required';
      } else if (!('gmPosition' in attrs)) {
        throw 'gmPosition';
      }

      // fn for updating markers from objects
      var updateMarkers = function(scope, objects) {

        var handlers = getEventHandlers(attrs); // map events -> handlers
        var objectCache = {};

        angular.forEach(objects, function(object) {
          var latLngObj = scope.gmPosition({object: object});
          var id = scope.gmId({object: object});

          var position = objToLatLng(latLngObj);
          if (position == null) {
            return;
          }

          var markerOptions = scope.gmMarkerOptions({object: object});

          // cache objects for quick access
          objectCache[id] = object;

          var markerExists = controller.hasMarker(scope.$id, id);

          if (!markerExists) {

            var options = {};
            angular.extend(options, markerOptions, {position: position});

            controller.addMarker(scope.$id, id, options);
            var marker = controller.getMarker(scope.$id, id);

            // set up marker event handlers
            angular.forEach(handlers, function(handler, event) {
              controller.addListener(marker, event, function() {
                $timeout(function() {
                       // scope is this directive's isolate scope
                       // scope.$parent is the scope of ng-transclude
                       // scope.$parent.$parent is the one we want
                  handler(scope.$parent.$parent, {
                    object: object,
                    marker: marker
                  });
                });
              });
            });
          }
        });

        // remove 'orphaned' markers
        var orphaned = [];
        
        controller.forEachMarkerInScope(scope.$id, function(marker, id) {
          if (!(id in objectCache)) {
            orphaned.push(id);
          }
        });

        angular.forEach(orphaned, function(id) {
          controller.removeMarker(scope.$id, id);
        });

        scope.$emit('gmMarkersUpdated', attrs.gmObjects);
      }; // end updateMarkers()

      // watch objects
      scope.$watch('gmObjects().length', function(newValue, oldValue) {
        if (newValue != null && newValue !== oldValue) {
          updateMarkers(scope, scope.gmObjects());
        }
      });

      scope.$watch('gmObjects()', function(newValue, oldValue) {
        if (newValue != null && newValue !== oldValue) {
          updateMarkers(scope, scope.gmObjects());
        }
      });

      // watch gmEvents
      scope.$watch('gmEvents()', function(newValue, oldValue) {
        if (newValue != null && newValue !== oldValue) {
          angular.forEach(newValue, function(eventObj) {
            var event = eventObj.event;
            var ids = eventObj.ids;
            angular.forEach(ids, function(id) {
              var marker = controller.getMarker(scope.$id, id);
              if (marker != null) {
                $timeout(angular.bind(this, controller.trigger, marker, event));
              }
            });
          });
        }
      });

      scope.$on('gmMarkersRedraw', function(event, objectsName) {
        if (objectsName == null || objectsName === attrs.gmObjects) {
          updateMarkers(scope);
          updateMarkers(scope, scope.gmObjects());
        }
      });

      // initialize markers
      $timeout(angular.bind(null, updateMarkers, scope, scope.gmObjects()));
    }


    return {
      restrict: 'AE',
      priority: 100,
      scope: {
        gmObjects: '&',
        gmId: '&',
        gmPosition: '&',
        gmMarkerOptions: '&',
        gmEvents: '&'
      },
      require: '^gmMap',
      link: link
    };
  }]);
})();
