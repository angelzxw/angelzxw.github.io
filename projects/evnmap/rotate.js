/**
 * To rotate the view of the scene, mouse event handlers are set up.
 * To rotate the reflective object, keyboard event handlers are set up.
 *
 * To be noted, in the roration of the view, there is no limit about
 * the rotation in left and right, which means beyound 360 degres is allowed.
 * but there is for up and down since in a real environment, it doesn't really
 * make sense to flip the view upside down.
 *
 * There is no limit in rotating the reflective object at all.
 */
function rotate(canvas, callback, viewDistance, rotY, rotX) {
    canvas.addEventListener("mousedown", doMouseDown, false);
    var rotateX = (rotX === undefined)? 0 : rotX;
    var rotateY = (rotY === undefined)? 0 : rotY;
    var xLimit = 85;
    var center;
    var degPerPixelX = 90/canvas.height;
    var degPerPixelY = 180/canvas.width;
    this.getXLimit = function() {
        return xLimit;
    }
    this.setXLimit = function(limitInDegrees) {
        xLimit = Math.min(85,Math.max(0,limitInDegrees));
    }
    this.getRotationCenter = function() {
        return (center === undefined) ? [0,0,0] : center;
    }
    this.setRotationCenter = function(rotationCenter) {
        center = rotationCenter;
    }
    this.setAngles = function( rotY, rotX ) {
        rotateX = Math.max(-xLimit, Math.min(xLimit,rotX));
        rotateY = rotY;
        if (callback) {
            callback();
        }
    }
    this.setViewDistance = function( dist ) {
        viewDistance = dist;
    }
    this.getViewDistance = function() {
        return (viewDistance === undefined)? 0 : viewDistance;
    }
    this.getViewMatrix = function() {
        var cosX = Math.cos(rotateX/180*Math.PI);
        var sinX = Math.sin(rotateX/180*Math.PI);
        var cosY = Math.cos(rotateY/180*Math.PI);
        var sinY = Math.sin(rotateY/180*Math.PI);
        var mat = [  // The product of rotation by rotationX about x-axis and by rotationY about y-axis.
            cosY, sinX*sinY, -cosX*sinY, 0,
            0, cosX, sinX, 0,
            sinY, -sinX*cosY, cosX*cosY, 0,
            0, 0, 0, 1
        ];
        if (center !== undefined) {  // multiply on left by translation by rotationCenter, on right by translation by -rotationCenter
            var t0 = center[0] - mat[0]*center[0] - mat[4]*center[1] - mat[8]*center[2];
            var t1 = center[1] - mat[1]*center[0] - mat[5]*center[1] - mat[9]*center[2];
            var t2 = center[2] - mat[2]*center[0] - mat[6]*center[1] - mat[10]*center[2];
            mat[12] = t0;
            mat[13] = t1;
            mat[14] = t2;
        }
        if (viewDistance !== undefined) {  // multipy on left by translation by (0,0,-viewDistance)
            mat[14] -= viewDistance;
        }
        return mat;
    }
    var prevX, prevY;  // previous position, while dragging
    var dragging = false;
    var touchStarted = false;
    function doMouseDown(evt) {
        if (dragging) {
            return;
        }
        dragging = true;
        document.addEventListener("mousemove", doMouseDrag, false);
        document.addEventListener("mouseup", doMouseUp, false);
        var r = canvas.getBoundingClientRect();
        prevX = evt.clientX - r.left;
        prevY = evt.clientY - r.top;
    }
    function doMouseDrag(evt) {
        if (!dragging) {
            return;
        }
        var r = canvas.getBoundingClientRect();
        var x = evt.clientX - r.left;
        var y = evt.clientY - r.top;
        var newRotX = rotateX + degPerPixelX * (y - prevY);
        var newRotY = rotateY + degPerPixelY * (x - prevX);
        newRotX = Math.max(-xLimit, Math.min(xLimit,newRotX));
        prevX = x;
        prevY = y;
        if (newRotX != rotateX || newRotY != rotateY) {
            rotateX = newRotX;
            rotateY = newRotY;
            if (callback) {
                callback();
            }
        }
    }
    function doMouseUp(evt) {
        if (!dragging) {
            return;
        }
        dragging = false;
        document.removeEventListener("mousemove", doMouseDrag, false);
        document.removeEventListener("mouseup", doMouseUp, false);
    }
}

function doKey(evt) {
    var isRotate = true;
    switch (evt.keyCode) {
        case 37:   // Left
          rotY -= 0.15;
          break;
        case 39:   // Right
          rotY +=  0.15;
          break;
        case 38:   // Up
          rotX -= 0.15;
          break;
        case 40:   // Down
          rotX += 0.15;
          break;
        default:
          isRotate = false;
    }
    if (isRotate) {
        evt.preventDefault();
        draw();
    }
}
