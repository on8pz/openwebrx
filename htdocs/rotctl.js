function rotctl_init() {
  const WS_URL = "ws://" + location.host + "/ws/rotor";

  const azDisplay = document.getElementById("az");
  const elDisplay = document.getElementById("el");

  const btnUp = document.getElementById("btnUp");
  const btnDown = document.getElementById("btnDown");
  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");

  const locatorInput = document.getElementById("locatorInput");
  const rotctl_preset = document.getElementById("rotctl_preset");
  const gotoLocBtn = document.getElementById("gotoLocBtn");

  const gotoAzInput = document.getElementById("gotoAzInput");
  const gotoAzBtn = document.getElementById("gotoAzBtn");

  const gotoElInput = document.getElementById("gotoElInput");
  const gotoElBtn = document.getElementById("gotoElBtn");

  const JOG_INTERVAL_MS = 150;
  const LIMITS = { azMin:0, azMax:360, elMin:0, elMax:90 };
  const STATION_LOCATOR = "JO21EE"; // set your QTH

  let rotctl_state = { az:0.0, el:0.0 };
  let rotctl_ws, rotctl_jogTimer=null;


  let xhr = new XMLHttpRequest();
  xhr.open('GET', 'static/rotctl_presets.txt', true);
  xhr.onreadystatechange = function() {
  if (xhr.readyState == 4 && xhr.status == 200)
    rotctl_preset.innerHTML = null;
    var opt = document.createElement('option');
    opt.value = "";
    opt.innerHTML = "";
    rotctl_preset.appendChild(opt);
    lines = xhr.responseText.split("\n");
    for (let i=0;i<lines.length;i++) {
      if (lines[i]!="") {
        var [call, loc] = lines[i].split(",");
        var opt = document.createElement('option');
        opt.value = loc;
        opt.innerHTML = call;
        rotctl_preset.appendChild(opt);
      }
    }
  }
  xhr.send();


  function rotctl_connectWS(){
    rotctl_ws = new WebSocket(WS_URL);

    rotctl_ws.onopen = ()=>{
      console.log("Connected to rotor WS");
      rotctl_pollPosition();
      setInterval(rotctl_pollPosition,1000);
    };
    rotctl_ws.onmessage = e => rotctl_parseMessage(e.data);
    rotctl_ws.onclose = ()=>{ console.warn("Rotor WS closed, retry in 3s"); setTimeout(rotctl_connectWS,3000); };
    rotctl_ws.onerror = e=>{ console.error("Rotor WS error",e); rotctl_ws.close(); };
  }

  function rotctl_send(cmd){
    if(rotctl_ws && rotctl_ws.readyState===WebSocket.OPEN) {
      //console.log("sending", cmd); 
      rotctl_ws.send(cmd);
    }
  }

  function rotctl_pollPosition(){ rotctl_send("ROTOR QUERY"); }

  function rotctl_moveTo(az, el){
    az = Math.min(Math.max(az,LIMITS.azMin),LIMITS.azMax);
    el = Math.min(Math.max(el,LIMITS.elMin),LIMITS.elMax);
    gotoAzInput.value = az.toFixed(1);
    gotoElInput.value = el.toFixed(1);
    rotctl_send(`ROTOR POS ${az.toFixed(1)} ${el.toFixed(1)}`);
  }
  
  function rotctl_moveInDir(dir){
    gotoAzInput.value = "";
    gotoElInput.value = "";
    locatorInput.value = "";
    rotctl_preset.value = "";
    speed = 100;
    rotctl_send(`ROTOR MOVE ${dir} ${speed}`);
  }

  function rotctl_stopRotor(){ rotctl_send("ROTOR STOP"); }

  function rotctl_startJog(dir){
    if(rotctl_jogTimer) return;
    rotctl_jogTimer = setInterval(()=>rotctl_moveInDir(dir),JOG_INTERVAL_MS);
  }

  function rotctl_stopJog(){ 
	  var doStop = false;
	  if (rotctl_jogTimer != null) doStop = true;
	  clearInterval(rotctl_jogTimer); 
	  rotctl_jogTimer=null; 
	  if (doStop) rotctl_stopRotor();
  }

  function rotctl_parseMessage(msg){
    if(!msg.startsWith("ROTOR-RESP ")) return;
    const data = msg.slice(11).trim().split(" ");
    if(data.length>=2 && data[0] == "RPRT") { 
	    if (data[1] != "0") console.log("rotctl error", data);
	    return;
    }
    //console.log(data);
    if(data.length>=2){ rotctl_state.az=parseFloat(data[0]); rotctl_state.el=parseFloat(data[1]); rotctl_updateDisplay(); }
  }

  function rotctl_updateDisplay(){ azDisplay.textContent=rotctl_state.az.toFixed(1)+"°"; elDisplay.textContent=rotctl_state.el.toFixed(1)+"°"; }

  // Maidenhead locator → lat/lon
  function rotctl_locatorToLatLon(loc){
    loc=loc.toUpperCase();
    if(loc.length!==6) return null;
    let lon=(loc.charCodeAt(0)-65)*20-180;
    let lat=(loc.charCodeAt(1)-65)*10-90;
    lon+=parseInt(loc[2])*2; lat+=parseInt(loc[3]);
    lon+=(loc.charCodeAt(4)-65)*5/60; lat+=(loc.charCodeAt(5)-65)*2.5/60;
    return {lat,lon};
  }

  function rotctl_bearing(from,to){
    const r=Math.PI/180;
    let φ1=from.lat*r, φ2=to.lat*r;
    let Δλ=(to.lon-from.lon)*r;
    let y=Math.sin(Δλ)*Math.cos(φ2);
    let x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    return (Math.atan2(y,x)/r+360)%360;
  }

  function rotctl_gotoLocator(loc){
    const from=rotctl_locatorToLatLon(STATION_LOCATOR);
    const to=rotctl_locatorToLatLon(loc);
    if(!from||!to) return;
    const az=rotctl_bearing(from,to);
    rotctl_moveTo(az,rotctl_state.el);
  }

  // Bind buttons (press-and-hold)
  ["mousedown","touchstart"].forEach(e=>btnUp.addEventListener(e,()=>rotctl_startJog(2)));
  ["mouseup","mouseleave","touchend","touchcancel"].forEach(e=>btnUp.addEventListener(e,rotctl_stopJog));

  ["mousedown","touchstart"].forEach(e=>btnDown.addEventListener(e,()=>rotctl_startJog(4)));
  ["mouseup","mouseleave","touchend","touchcancel"].forEach(e=>btnDown.addEventListener(e,rotctl_stopJog));

  ["mousedown","touchstart"].forEach(e=>btnLeft.addEventListener(e,()=>rotctl_startJog(8)));
  ["mouseup","mouseleave","touchend","touchcancel"].forEach(e=>btnLeft.addEventListener(e,rotctl_stopJog));

  ["mousedown","touchstart"].forEach(e=>btnRight.addEventListener(e,()=>rotctl_startJog(16)));
  ["mouseup","mouseleave","touchend","touchcancel"].forEach(e=>btnRight.addEventListener(e,rotctl_stopJog));

  // Goto buttons
  gotoLocBtn.onclick=()=>rotctl_gotoLocator(locatorInput.value.trim());
  gotoAzBtn.onclick=()=>{ const az=parseFloat(gotoAzInput.value); if(!isNaN(az)) rotctl_moveTo(az,(gotoElInput.value==""?rotctl_state.el:gotoElInput.value)); };
  gotoElBtn.onclick=()=>{ const el=parseFloat(gotoElInput.value); if(!isNaN(el)) rotctl_moveTo((gotoAzInput.value==""?rotctl_state.az:gotoAzInput.value),el); };
  rotctl_preset.onchange=()=>{ locatorInput.value = rotctl_preset.value };

  document.addEventListener("DOMContentLoaded",rotctl_connectWS);
}
