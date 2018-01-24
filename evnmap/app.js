var gl;
var canvas;

var dataSKY;   // Data for the skybox
var dataENV;   // Data for environment map
var dataLIT;   // Data for the program with lighting for moving objects

var projection = mat4.create();
var modelview;
var normalMatrix = mat3.create();
var invViewTrans = mat3.create();  // The inverse of the view transform rotation matrix, used in skybox shader program.

var skyboxCube;    // The cube that is rendered to show the skybox.
var skyboxCubemap; // The static cubemap texture for the skybox

var dynCubemap;    // The cubemap texture for the teapot, created dynamically.
var frameBuf;      // A framebuffer for rendering the dynamic cubemap texture that is used on the central reflective object.

var reflObjs;      // An array of models for reflective objects

var count;         // Number of dynamic objects
// Models for moving objects
var cubeModel;     // Solid cube
var cyl0Model;     // Solid cylinder
var cyl1Model;     // Hollow cylinder
var coneModel;     // Solid cone
var dynObjsData;   // An array holds information about moving objects

var rotator;       // A rotate object to enable rotation by mouse dragging.
var rotX = 0, rotY = 0;

var cubemapTargs;  // An array of six faces of a cubemap texture.

var animating = false;
var frameNumber = 0;

function init() {
    try {
        canvas = document.getElementById("mycanvas");
        gl = canvas.getContext("webgl") ||
                         canvas.getContext("experimental-webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Can't get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Can't initialize the WebGL graphics context:" + e + "</p>";
        return;
    }
    document.getElementById("isAnimate").checked = false;
    document.getElementById("isAnimate").onchange = doAnimation;
    document.getElementById("object").value = "0";
    document.getElementById("object").onchange = function() {
        if (document.getElementById("object").value == 100 || document.getElementById("object").value == 6){
          document.getElementById("objectSize").disabled = true;
        }else{
          document.getElementById("objectSize").disabled = false;
        }
        draw();
        document.getElementById("reset").focus();  // To make sure arrow key input is not sent to popup menu
    }
    document.getElementById("objectSize").value = "0";
    document.getElementById("objectSize").onchange = function() {
        draw();
        document.getElementById("reset").focus();
    }
    document.addEventListener("keydown", doKey, false);
    document.getElementById("reset").onclick = function() {
        rotX = rotY = 0;
        rotator.setAngles(0,0);
        frameNumber = 0;
        draw();
    };
    rotator = new rotate(canvas,function() {
        if (!animating)
           draw();
    },3);
    count = document.getElementById("numObj").value;
    if (count < 15){
      createDynObjData(count);
    }else{
        document.getElementById("canvas-holder").innerHTML = "Please enter a number less than 15.";
    }
    installTexture();
}

function initGL() {
    cubemapTargs = [
       gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
       gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
       gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
    ];

    gl.enable(gl.DEPTH_TEST);

    dataSKY = {};  // Data for the skybox shader program
    dataSKY.prog = createProgram(gl, "vshaderSKY", "fshaderSKY");
    dataSKY.a_coords_loc =  gl.getAttribLocation(dataSKY.prog, "a_coords");
    dataSKY.u_modelview = gl.getUniformLocation(dataSKY.prog, "modelview");
    dataSKY.u_projection = gl.getUniformLocation(dataSKY.prog, "projection");
    dataSKY.u_skybox = gl.getUniformLocation(dataSKY.prog, "skybox");
    gl.useProgram(dataSKY.prog);
    gl.uniform1i(dataSKY.u_skybox, 0);

    dataENV = {};  // Data for the envrionment map program
    dataENV.prog = createProgram(gl, "vshaderENV", "fshaderENV"),
    dataENV.a_coords_loc =  gl.getAttribLocation(dataENV.prog, "a_coords"),
    dataENV.a_normal_loc =  gl.getAttribLocation(dataENV.prog, "a_normal"),
    dataENV.u_modelview = gl.getUniformLocation(dataENV.prog, "modelview"),
    dataENV.u_projection = gl.getUniformLocation(dataENV.prog, "projection"),
    dataENV.u_normalMatrix = gl.getUniformLocation(dataENV.prog, "normalMatrix"),
    dataENV.u_invViewTrans = gl.getUniformLocation(dataENV.prog, "invViewTrans")
    dataENV.u_skybox = gl.getUniformLocation(dataENV.prog, "skybox");
    gl.useProgram(dataENV.prog);
    gl.uniform1i(dataENV.u_skybox, 0);

    dataLIT = {};  // Data for the program with lighting, used for the moving cubes
    dataLIT.prog = createProgram(gl, "vshaderLIT", "fshaderLIT"),
    gl.useProgram(dataLIT.prog);
    dataLIT.a_coords_loc =  gl.getAttribLocation(dataLIT.prog, "a_coords"),
    dataLIT.a_normal_loc =  gl.getAttribLocation(dataLIT.prog, "a_normal"),
    dataLIT.u_modelview = gl.getUniformLocation(dataLIT.prog, "modelview"),
    dataLIT.u_projection = gl.getUniformLocation(dataLIT.prog, "projection"),
    dataLIT.u_normalMatrix =  gl.getUniformLocation(dataLIT.prog, "normalMatrix")
    dataLIT.u_material = {
        diffuseColor: gl.getUniformLocation(dataLIT.prog, "material.diffuseColor"),
        specularColor: gl.getUniformLocation(dataLIT.prog, "material.specularColor"),
        specularExponent: gl.getUniformLocation(dataLIT.prog, "material.specularExponent")
    };
    dataLIT.u_lights = new Array(3);
    for (var i = 0; i < 3; i++) {
        dataLIT.u_lights[i] = {
            enabled: gl.getUniformLocation(dataLIT.prog, "lights[" + i + "].enabled"),
            position: gl.getUniformLocation(dataLIT.prog, "lights[" + i + "].position"),
            color: gl.getUniformLocation(dataLIT.prog, "lights[" + i + "].color"),
        };
        gl.uniform1i(dataLIT.u_lights[i].enabled, 1)
    }
    gl.uniform3f(dataLIT.u_lights[0].color, 0.5, 0.5, 0.5);  // Light positions set in world coordinates
    gl.uniform3f(dataLIT.u_lights[1].color, 0.4, 0.4, 0.4);
    gl.uniform3f(dataLIT.u_lights[2].color, 0.3, 0.3, 0.3);
    gl.uniform1f(dataLIT.u_material.specularExponent, 32);  // Diffuse color set for individual object
    gl.uniform3f(dataLIT.u_material.specularColor, 0.2, 0.2, 0.2);

    skyboxCube = createModelSKY(cube(100));

    reflObjs = new Array(7);
    reflObjs[0] = createModelENV(cube(0.4));
    reflObjs[1] = createModelENV(cube(0.6));
    reflObjs[2] = createModelENV(cube(0.8));
    reflObjs[3] = createModelENV(sphere(0.3,64,32));
    reflObjs[4] = createModelENV(sphere(0.55,64,32));
    reflObjs[5] = createModelENV(sphere(0.8,64,32));
    for (var i = 0; i < teapotModel.vertexPositions.length; i++) {
        teapotModel.vertexPositions[i] *= 0.05; // Scale teapot model
    }
    reflObjs[6] = createModelENV(teapotModel);

    cubeModel = createModelLIT(cube(0.8));
    cyl0Model = createModelLIT(uvCylinder(0.5, 0.8, 32, 0, 0));
    cyl1Model = createModelLIT(uvCylinder(0.5, 0.8, 32, 1, 1));
    coneModel = createModelLIT(uvCone(0.8, 0.8, 32, 0));

    skyboxCubemap = gl.createTexture();
    dynCubemap = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, dynCubemap);
    for (i = 0; i < 6; i++) {
        gl.texImage2D(cubemapTargs[i], 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    frameBuf = gl.createFramebuffer();  // Framebuffer for the reflection map
    gl.bindFramebuffer(gl.FRAMEBUFFER,frameBuf);
    var depthBuf = gl.createRenderbuffer();   // Renderbuffer for depth buffer in framebuffer
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuf);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 512, 512);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuf);

    if (gl.getError() != gl.NO_ERROR) {
        document.getElementById("canvas-holder").innerHTML = "Some WebGL error occurred while trying to create framebuffer.";
    }
}

function frame() {
    if (animating) {
        frameNumber++;
        draw();
        requestAnimationFrame(frame);
    }
}

function doAnimation() {
    var run = document.getElementById("isAnimate").checked;
    if (run != animating) {
        animating = run;
        if (animating)
            requestAnimationFrame(frame);
    }
}

//Draws one frame of the animation
function draw() {
    if (!skyboxCubemap) {
        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        return;
    }
    createDynCubemap();  // Create the dynamic cubemap texture for this frame.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.useProgram(dataSKY.prog);
    mat4.perspective(projection, Math.PI/4, 1, 1, 100);
    modelview = rotator.getViewMatrix();
    renderSkyboxAndObjs();  // Draws everything except the reflective object.

    // Get the inverse of the rotation that was applied to the skybox
    mat3.fromMat4(invViewTrans, modelview);
    mat3.invert(invViewTrans,invViewTrans);
    mat4.rotateX(modelview,modelview,rotX);
    mat4.rotateY(modelview,modelview,rotY);
    mat3.normalFromMat4(normalMatrix, modelview);

    // Draw the reflective object using the environment map
    gl.useProgram(dataENV.prog);
    mat4.perspective(projection, Math.PI/4, 1, 1, 10);
    gl.uniformMatrix4fv(dataENV.u_projection, false, projection);
    mat3.normalFromMat4(normalMatrix, modelview);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, dynCubemap);
    gl.enableVertexAttribArray(dataENV.a_coords_loc);
    gl.enableVertexAttribArray(dataENV.a_normal_loc);
    var objNum_x = Number(document.getElementById("object").value);
    var objNum_y = Number(document.getElementById("objectSize").value);
    var objNum = objNum_x + objNum_y;
    if (objNum < 100){
      reflObjs[objNum].render();
    }
    gl.disableVertexAttribArray(dataENV.a_coords_loc);
    gl.disableVertexAttribArray(dataENV.a_normal_loc);
}

/**
 * This function is to render the dynamic cubemap texture for the current frame.
 * It takes 6 "photos" of the environment using a "camera" that is located at the origin and
 * has a 90-degree field of view. The camera points in the direction of the negative z-axis.
 */
function createDynCubemap() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuf);
    gl.viewport(0,0,512,512);  //match size of the texture images
    mat4.perspective(projection, Math.PI/2, 1, 1, 100);  // Set projection to give 90-degree field of view.

    modelview = mat4.create();

    mat4.identity(modelview);
    mat4.scale(modelview,modelview,[-1,-1,1]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, dynCubemap, 0);
    renderSkyboxAndObjs();

    mat4.identity(modelview);
    mat4.scale(modelview,modelview,[-1,-1,1]);
    mat4.rotateY(modelview,modelview,Math.PI/2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X, dynCubemap, 0);
    renderSkyboxAndObjs();

    mat4.identity(modelview);
    mat4.scale(modelview,modelview,[-1,-1,1]);
    mat4.rotateY(modelview,modelview,Math.PI);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, dynCubemap, 0);
    renderSkyboxAndObjs();

    mat4.identity(modelview);
    mat4.scale(modelview,modelview,[-1,-1,1]);
    mat4.rotateY(modelview,modelview,-Math.PI/2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, dynCubemap, 0);
    renderSkyboxAndObjs();

    mat4.identity(modelview);
    mat4.rotateX(modelview,modelview,Math.PI/2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, dynCubemap, 0);
    renderSkyboxAndObjs();

    mat4.identity(modelview);
    mat4.rotateX(modelview,modelview,-Math.PI/2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, dynCubemap, 0);
    renderSkyboxAndObjs();

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, dynCubemap);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
}

/**
 * Draws the entire scene except for the reflective object.
 * To be noted, the reflective object is not in the environment map
 * since the camera is inside that object, and the camera would only see the inside of the object.
 */
function renderSkyboxAndObjs() {

    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw the skybox with its static cubemap texture.
    gl.useProgram(dataSKY.prog);
    gl.uniformMatrix4fv(dataSKY.u_projection, false, projection);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxCubemap);
    if (skyboxCubemap) {
        gl.enableVertexAttribArray(dataSKY.a_coords_loc);
        skyboxCube.render();
        gl.disableVertexAttribArray(dataSKY.a_coords_loc);
    }

    gl.useProgram(dataLIT.prog);
    gl.uniformMatrix4fv(dataLIT.u_projection, false, projection);
    gl.enableVertexAttribArray(dataLIT.a_coords_loc);
    gl.enableVertexAttribArray(dataLIT.a_normal_loc);

    // Lights must have their position multiplied by the modelview transform, which now
    // is only the viewing transform, to place them into world coordinates.
    // Light color was set in initGL() and all three lights are enabled.

    gl.uniform4f(dataLIT.u_lights[0].position, 0, 0, 0, 1); // positional light at origin
    var transformed = vec4.create();
    vec4.transformMat4(transformed, [0,1,0,0], modelview); // directional light from above
    gl.uniform4fv(dataLIT.u_lights[1].position, transformed);
    vec4.transformMat4(transformed, [0,-1,0,0], modelview); // directinal light from below.
    gl.uniform4fv(dataLIT.u_lights[2].position, transformed);

    for (var i = 0; i < dynObjsData.length; i++) {  // draw the moving objects
        var tmp_mv = mat4.clone(modelview);
        var tmp = dynObjsData[i];
        mat4.rotate(modelview, modelview, frameNumber * tmp.globalAngularVelocity, tmp.globalRotationAxis);
        mat4.translate(modelview,modelview,tmp.translation);
        mat4.rotate(modelview, modelview, frameNumber * tmp.localAngularVelocity, tmp.localRotationAxis);
        mat3.normalFromMat4(normalMatrix, modelview);
        gl.uniform3fv(dataLIT.u_material.diffuseColor, tmp.color);
        var r = i % 4;
        if (r == 0){
          cubeModel.render();
        }else if (r == 1){
          coneModel.render();
        }else if (r == 2){
          cyl0Model.render();
        }else{
          cyl1Model.render();
        }
        modelview = tmp_mv;
    }
    gl.disableVertexAttribArray(dataLIT.a_coords_loc);
    gl.disableVertexAttribArray(dataLIT.a_normal_loc);
}

/**
 * Create an array of moving objects given a number of amount.
 * Each cube has a random color, and it rotates in its own object coordinate system and then rotates about the
 * origin.
 */
function createDynObjData(count) {
    dynObjsData = [];
    for (var i = 0; i < count; i++) {
        dynObjsData.push({
            translation: [(2 * i - 5), 0, -3], // Initial position
            localRotationAxis: [Math.random(),Math.random(),Math.random()],
            localAngularVelocity: 0.01 + 0.15 * Math.random(),
            globalRotationAxis: [Math.random(),Math.random(),Math.random()],
            globalAngularVelocity: 0.01 + 0.02 * Math.random(),
            color: [Math.random(),Math.random(),Math.random()]
        });
        vec3.normalize(dynObjsData[i].localRotationAxis, dynObjsData[i].localRotationAxis);
        vec3.normalize(dynObjsData[i].globalRotationAxis, dynObjsData[i].globalRotationAxis);
        if (Math.random() < 0.5) {
            dynObjsData[i].globalAngularVelocity  *= -1;
        }
    }
}


// Load the images for the skybox texture cube
function installTexture() {
    var ct = 0;
    var img = new Array(6);
    var urls = [
       "img/posx.jpg", "img/negx.jpg",
       "img/posy.jpg", "img/negy.jpg",
       "img/posz.jpg", "img/negz.jpg"
    ];
    for (var i = 0; i < 6; i++) {
        img[i] = new Image();
        img[i].onload = function() {
            ct++;
            if (ct == 6) {
                skyboxCubemap = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxCubemap);
                try {
                    for (var j = 0; j < 6; j++) {
                        gl.texImage2D(cubemapTargs[j], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img[j]);
                        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    }
                } catch(e) {
                    document.getElementById("canvas-holder").innerHTML = "Can't access skybox texture.";
                }
                gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
                if (animating) {
                    requestAnimationFrame(frame);
                }
                else {
                    draw();
                }
            }
        }
        img[i].src = urls[i];
    }
}

// Creating the model for the skybox
function createModelSKY(modelData) {
    var model = {};
    model.coordsBuffer = gl.createBuffer();
    model.indexBuffer = gl.createBuffer();
    model.count = modelData.indices.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, model.coordsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexPositions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, modelData.indices, gl.STATIC_DRAW);
    model.render = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.coordsBuffer);
        gl.vertexAttribPointer(dataSKY.a_coords_loc, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(dataSKY.u_modelview, false, modelview);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
    return model;
}

// Create the reflective object models
function createModelENV(modelData) {
    var model = {};
    model.coordsBuffer = gl.createBuffer();
    model.normalBuffer = gl.createBuffer();
    model.indexBuffer = gl.createBuffer();
    model.count = modelData.indices.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, model.coordsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexPositions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexNormals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, modelData.indices, gl.STATIC_DRAW);
    model.render = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.coordsBuffer);
        gl.vertexAttribPointer(dataENV.a_coords_loc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(dataENV.a_normal_loc, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(dataENV.u_modelview, false, modelview);
        gl.uniformMatrix3fv(dataENV.u_normalMatrix, false, normalMatrix);
        gl.uniformMatrix3fv(dataENV.u_invViewTrans, false, invViewTrans);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
    return model;
}

// Create the model for the moving cubes rendered with lighting
function createModelLIT(modelData) {
    var model = {};
    model.coordsBuffer = gl.createBuffer();
    model.normalBuffer = gl.createBuffer();
    model.indexBuffer = gl.createBuffer();
    model.count = modelData.indices.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, model.coordsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexPositions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexNormals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, modelData.indices, gl.STATIC_DRAW);
    model.render = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.coordsBuffer);
        gl.vertexAttribPointer(dataLIT.a_coords_loc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(dataLIT.a_normal_loc, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(dataLIT.u_modelview, false, modelview);
        gl.uniformMatrix3fv(dataLIT.u_normalMatrix, false, normalMatrix);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
    return model;
}

// Creates a program for use in the WebGL context gl identifier for that program.
function createProgram(gl, vertexShaderID, fragmentShaderID) {
    function getTextContent(elementID) {
            // This nested function retrieves the text content of an
            // element on the web page.  It is used here to get the shader
            // source code from the script elements that contain it.
        var element = document.getElementById(elementID);
        var node = element.firstChild;
        var str = "";
        while (node) {
            if (node.nodeType == 3)
                str += node.textContent;
            node = node.nextSibling;
        }
        return str;
    }
    try {
        var vertexShaderSource = getTextContent(vertexShaderID);
        var fragmentShaderSource = getTextContent(fragmentShaderID);
    }
    catch (e) {
        throw "Error: Could not get shader source code from script elements.";
    }
    var vex_sh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vex_sh,vertexShaderSource);
    gl.compileShader(vex_sh);
    if (!gl.getShaderParameter(vex_sh, gl.COMPILE_STATUS)) {
        throw "Error in vertex shader:  " + gl.getShaderInfoLog(vex_sh);
     }
    var frg_sh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frg_sh, fragmentShaderSource);
    gl.compileShader(frg_sh);
    if (!gl.getShaderParameter(frg_sh, gl.COMPILE_STATUS)) {
       throw "Error in fragment shader:  " + gl.getShaderInfoLog(frg_sh);
    }
    var prog = gl.createProgram();
    gl.attachShader(prog,vex_sh);
    gl.attachShader(prog, frg_sh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
       throw "Link error in program:  " + gl.getProgramInfoLog(prog);
    }
    return prog;
}

//Create a model of a cube.
function cube(side) {
   var s = (side || 1)/2;
   var coords = [];
   var normals = [];
   var texCoords = [];
   var indices = [];
   function face(xyz, nrm) {
      var start = coords.length/3;
      var i;
      for (i = 0; i < 12; i++) {
         coords.push(xyz[i]);
      }
      for (i = 0; i < 4; i++) {
         normals.push(nrm[0], nrm[1], nrm[2]);
      }
      texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(start, start+1, start+2, start, start+2, start+3);
   }
   face([-s, -s, s,  s, -s, s,  s, s, s,  -s, s, s],  [0, 0, 1]);
   face([-s, -s, -s,  -s, s, -s,  s, s, -s,  s, -s, -s],  [0, 0, -1]);
   face([-s, s, -s,  -s, s, s,  s, s, s,  s, s, -s],  [0, 1, 0]);
   face([-s, -s, -s,  s, -s, -s,  s, -s, s,  -s, -s, s],  [0, -1, 0]);
   face([s, -s, -s,  s, s, -s,  s, s, s,  s, -s, s],  [1, 0, 0]);
   face([-s, -s, -s,  -s, -s, s,  -s, s, s,  -s, s, -s],  [-1, 0, 0]);
   return {
      vertexPositions: new Float32Array(coords),
      vertexNormals: new Float32Array(normals),
      vertexTextureCoords: new Float32Array(texCoords),
      indices: new Uint16Array(indices)
   }
}

// Create a model of a sphere.
function sphere(radius, slices, stacks) {
   radius = radius || 0.5;
   slices = slices || 32;
   stacks = stacks || 16;
   var vertexCount = (slices+1)*(stacks+1);
   var vertices = new Float32Array(3 * vertexCount);
   var normals = new Float32Array(3 *  vertexCount);
   var texCoords = new Float32Array(2 * vertexCount);
   var indices = new Uint16Array(2 * slices * stacks * 3);
   var du = 2 * Math.PI/slices;
   var dv = Math.PI/stacks;
   var i, j, u, v, x, y, z;
   var indexV = 0;
   var indexT = 0;
   for (i = 0; i <= stacks; i++) {
      v = -Math.PI/2 + i * dv;
      for (j = 0; j <= slices; j++) {
         u = j * du;
         x = Math.cos(u) * Math.cos(v);
         y = Math.sin(u) * Math.cos(v);
         z = Math.sin(v);
         vertices[indexV] = radius * x;
         normals[indexV++] = x;
         vertices[indexV] = radius * y;
         normals[indexV++] = y;
         vertices[indexV] = radius * z;
         normals[indexV++] = z;
         texCoords[indexT++] = j/slices;
         texCoords[indexT++] = i/stacks;
      }
   }
   var k = 0;
   for (j = 0; j < stacks; j++) {
      var row1 = j * (slices+1);
      var row2 = (j+1) * (slices+1);
      for (i = 0; i < slices; i++) {
          indices[k++] = row1 + i;
          indices[k++] = row2 + i + 1;
          indices[k++] = row2 + i;
          indices[k++] = row1 + i;
          indices[k++] = row1 + i + 1;
          indices[k++] = row2 + i + 1;
      }
   }
   return {
       vertexPositions: vertices,
       vertexNormals: normals,
       vertexTextureCoords: texCoords,
       indices: indices
   };
}
