import * as THREE from 'three'

//basic setup inspired by https://github.com/mrdoob/three.js/
export default class Raymarcher{
  constructor(){

    this.vertex = this.vertex();
    this.fragment = this.fragment();

    this.mousePosition = new THREE.Vector2(0,0);
    this.renderer = new THREE.WebGLRenderer( { antialias: true } );
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    document.getElementById('container').appendChild( this.renderer.domElement );

    this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
    this.camera.position.z = 1;

    this.scene = new THREE.Scene();
    this.addMesh();
    this.time = 0;
    this.render();
  }

  addMesh(){
    this.geometry = new THREE.PlaneBufferGeometry(3, 3);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time : {value : 0},
        mousePos : {value : this.mousePosition}
      },
      fragmentShader : this.fragment,
      vertexShader : this.vertex,
    });
    this.mesh = new THREE.Mesh( this.geometry, this.material );
    this.scene.add( this.mesh );
  }

  render(){
    this.time++;

    //update fragment shader uniforms
    this.mesh.material.uniforms.time.value = this.time;
    this.mesh.material.uniforms.mousePos.value = this.mousePosition;

	  this.renderer.render( this.scene, this.camera );
    window.requestAnimationFrame(this.render.bind(this));
  }

  vertex(){
    return `
    varying vec2 vUv;
    void main(){
        vUv = uv;
    
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
        gl_Position = projectionMatrix * mvPosition;
    }`
  }

  fragment(){
    return `
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec2 mousePos;
    uniform float time;
    varying vec2 vUv;

    #define eps 0.001

    //from: https://gist.github.com/yiwenl/3f804e80d0930e34a0b33359259b556c
    mat4 rotationMatrix(vec3 axis, float angle) {
      axis = normalize(axis);
      float s = sin(angle);
      float c = cos(angle);
      float oc = 1.0 - c;
      
      return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                  oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                  oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                  0.0,                                0.0,                                0.0,                                1.0);
    }
  
    vec3 rotate(vec3 v, vec3 axis, float angle) {
      mat4 m = rotationMatrix(axis, angle);
      return (m * vec4(v, 1.0)).xyz;
    }

    //sdf functions from: https://iquilezles.org/www/articles/distfunctions/distfunctions.htm
    //smooth min function from: https://www.iquilezles.org/www/articles/smin/smin.htm
    float sdBox( vec3 pos, vec3 b )
    {
      vec3 q = abs(pos) - b;
      return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }

    float sdSphere(vec3 pos, float radius){
        return length(pos) - radius;
    }

    float sdSphereMouse(vec3 pos, float radius){
      vec3 position = vec3(pos.xy - mousePos,pos.z);
      return length(position) - radius;
    }

    float smin( float a, float b, float k )
    {
      float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
      return mix( b, a, h ) - k*h*(1.0-h);
    }

    //calculate the distance to the scene
    float sdf(vec3 pos){
      vec3 rotatedPos = rotate(pos, vec3(1.), time/60.);
      float boxDist = sdBox(rotatedPos, vec3(0.5));
      float sphereDist = sdSphere(rotatedPos, 0.7);
      float sphereMouseDist = sdSphereMouse(pos, 0.4);

      //smoothing between objects, the '0.1' and '0.6' values determine the level of smoothing applied to the function
      return smin(sphereMouseDist, smin(boxDist, sphereDist, 0.1), 0.6);
    }
    
    //maxDist and maxSteps were chosen randomly, feel free to change
    vec3 raymarch(vec3 rayPos, vec3 rayDir){
      float dist = 0.0;
      float maxDist = 20.;
      int steps = 0;
      int maxSteps = 200;
      //GLSL doesnt allow using outside variables in loop declarations, so steps and maxSteps cannot be used instead of i and 200
      for(int i = 0; i<200;++i){
          //move along the ray
          vec3 pos = rayPos + dist * rayDir;
          float distToScene = sdf(pos);
  
          dist += distToScene;
          //object hit or no more hits possible
          if(distToScene < eps || dist > maxDist){
            //setting steps here or outside the if-block determines if the background is black or white
            steps = i;
            break;
          }
      }
      //more steps taken = darker color
      vec3 color = vec3(1. - float(steps)/float(maxSteps));
      return color;
    }
    
    void main(){
      //define a camera, the camera position is also the ray origin
      vec3 camPos = vec3(0.,0.,3.);

      //move ray to make sure that the origin is in the center of the screen([0,0] -> [.5, .5])
      vec3 rayDir =  normalize(vec3( (vUv - vec2(.5)), -.5));
      
      vec3 color = raymarch(camPos, rayDir);
    
      gl_FragColor = vec4(color.x , color.y, color.z,1.0);
    }
  `
  }
}

var raymarcher = new Raymarcher();

//mouse control
var mousePosition = new THREE.Vector2();
document.addEventListener('mousemove', onDocumentMouseMove, false);

function onDocumentMouseMove(event){
  var mouseX = ( event.clientX / window.innerWidth ) * 2 - 1;

  mousePosition = new THREE.Vector2(mouseX, -( event.clientY / window.innerHeight ) * 2 + 1);
  raymarcher.mousePosition = mousePosition;
}