const MOD_NAME = "pushable";
const LAMBDA = 5;

function Lang(k){
  return game.i18n.localize("PUSHABLE."+k);
}

let pushable_socket;
Hooks.once("socketlib.ready", () => {
  pushable_socket = socketlib.registerModule("pushable");  
  pushable_socket.register("moveAsGM", doMoveAsGM);
});

function doMoveAsGM(updates){
  canvas.scene.updateEmbeddedDocuments('Token', updates, {pushable_triggered:true});
}

function scrollText(token, text){
  let config = {
    x: token.x,
    y: token.y,
    text: text,
    anchor: foundry.CONST.TEXT_ANCHOR_POINTS.TOP, 
    fill:   "#FFFFFF", 
    stroke: "#FFFFFF"
  }
  canvas.interface.createScrollingText(token, text, config);
}

function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
  return !(x2 > w1 + x1 || x1 > w2 + x2 || y2 > h1 + y1 || y1 > h2 + y2);  
}

function isPushable(token){
  return token.document?.flags.pushable?.isPushable ||
         token.flags?.pushable?.isPushable; 
}

function find_collisions(token){
  let x1 = token.x + LAMBDA;
  let y1 = token.y + LAMBDA;
  let w1 = token.w - (LAMBDA * 2);
  let h1 = token.h - (LAMBDA * 2);
  let collisions = [];

  for (let tok of canvas.tokens.placeables){
    if (tok.id != token.id){
      let x2 = tok.x;
      let y2 = tok.y;
      let w2 = tok.w;
      let h2 = tok.h;
      
      if (rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2)){
        collisions.push(tok);
      }
    }
  }
  return collisions;
}

function duplicate_tk(token){
  return {  
    id: token.id,
    x: token.x, 
    y: token.y,
    flags: { pushable: { isPushable: isPushable(token) } },            
    w: token.w,
    h: token.h,
    _id: token.id
  };
}

function collides_with_wall(token, direction) {
  const origin = token.center;
  const target = new PIXI.Point(origin.x + direction.x, origin.y + direction.y);

  // ClockwiseSweepPolygon implements _testCollision in v13 (PointSourcePolygon is now abstract)
  return foundry.canvas.geometry.ClockwiseSweepPolygon.testCollision(origin, target, {
    type: "move",
    mode: "any"
  });
}
function candidate_move(token, direction, updates, depth){
  let pushlimit = game.settings.get('pushable', 'max_depth');
  if ((depth > pushlimit + 1) && (pushlimit > 0)) { return false; } 

  let result = { valid: true };
  let colls = find_collisions(token);
  if (colls.length == 0){ return result; }

  let len = Math.sqrt(direction.x**2 + direction.y**2);
  let dir = { x: direction.x / len, y: direction.y / len };
  let wePushable = isPushable(token);

  for (let coll_obj of colls){
    let nx = coll_obj.x;
    let ny = coll_obj.y;
    let collPushable = isPushable(coll_obj);

    if (wePushable && !collPushable){
      if (game.settings.get(MOD_NAME, 'collideWithNonPushables')){
        return { valid: false, reason: "CantPushEntity" };
      } else {
        continue;
      }
    }
    if (!wePushable && !collPushable){ continue; }

    if (direction.x){
      nx = (direction.x > 0) ? (token.x + token.w) : (token.x - coll_obj.w);
    }
    if (direction.y){
      ny = (direction.y > 0) ? (token.y + token.h) : (token.y - coll_obj.h);
    }

    let new_dir = { x: nx - coll_obj.x, y: ny - coll_obj.y };

    if (collides_with_wall(coll_obj, new_dir)){
      return { valid: false, reason: "CantPushWall" };
    }

    updates.push({ _id: coll_obj.id, id: coll_obj.id, x: nx, y: ny });
    if (overLimit(updates)){
      return { valid: false, reason: 'CantPushMax' };
    }

    let candidate_token = duplicate_tk(coll_obj);
    candidate_token.x += new_dir.x;
    candidate_token.y += new_dir.y;
    let res = candidate_move(candidate_token, new_dir, updates, depth + 1);   
    result.valid &= res.valid;
    if (!res.valid){ result.reason = res.reason; }
  }
  return result;
}

function tokenAtPoint(p){
  for (let tok of canvas.tokens.placeables){
    if (p.x > tok.x && p.x < tok.x + tok.w && p.y > tok.y && p.y < tok.y + tok.h){
      return tok;
    }
  }
  return null;
}

function checkPull(token, direction, updates){
  let l = Math.sqrt(direction.x**2 + direction.y**2);
  let nv = { x: direction.x / l, y: direction.y / l };
  let center = { x: token.x + token.w / 2, y: token.y + token.h / 2 };
  let pull_from = { x: center.x - token.w * nv.x, y: center.y - token.h * nv.y };
  let ray = new Ray(new PIXI.Point(pull_from.x, pull_from.y), new PIXI.Point(center.x, center.y));
  if (foundry.canvas.geometry.ClockwiseSweepPolygon.testCollision(new PIXI.Point(pull_from.x, pull_from.y), new PIXI.Point(center.x, center.y), { type: "move", mode: "any" })) {
    return { valid: false, reason: "CantPull" };
  }

  let colls = find_collisions(token);
  if (colls.length && game.settings.get(MOD_NAME, 'collideWithNonPushables')){
    return { valid: false, reason: "CantPullEntity" };
  }

  let pulle = tokenAtPoint(pull_from);  
  if (pulle){
    if (pulle.document.getFlag(MOD_NAME, 'isPullable')){
      updates.push({ id: pulle.id, x: pulle.x + direction.x, y: pulle.y + direction.y, _id: pulle.id });
    } else {
      return { valid: false, reason: "CantPull" };
    }
  }
  return { valid: true };
}

function showHint(token, hint, isError = true){
  if (game.settings.get(MOD_NAME, "showHints")){
    scrollText(token, hint);
  }
}

function overLimit(updates){
  let limit = game.settings.get(MOD_NAME, 'max_depth');
  return !(limit < 0 || updates.length <= limit);
}

Hooks.on('preUpdateToken', (token, change, options, user_id) => {
  if (foundry.utils.hasProperty(options, 'pushable_triggered')) return true;
  if (!foundry.utils.hasProperty(change, 'x') && !foundry.utils.hasProperty(change, 'y')) return true;

  let nx = foundry.utils.hasProperty(change, 'x') ? change.x : token.x;
  let ny = foundry.utils.hasProperty(change, 'y') ? change.y : token.y;
  let direction = { x: nx - token.x, y: ny - token.y };
  let tok = canvas.tokens.get(token.id);
  let token_after_move = duplicate_tk(tok);
  token_after_move.x = nx;
  token_after_move.y = ny;
  let res = { valid: true };

  let updates = [];
  if (game.settings.get("pushable", "pull")){
    let pulling = false;
    let pk = game.keybindings.get("pushable", 'pull_key');
    for (let k of pk){ pulling ||= game.keyboard.downKeys.has(k.key); }
    if (pulling){
      let result = checkPull(tok, direction, updates);
      if (!result.valid){ showHint(tok, Lang(result.reason)); }
    }
  }

  res = candidate_move(token_after_move, direction, updates, 1);  
  if (!res.valid){ showHint(tok, Lang(res.reason)); }
  if (res.valid && updates.length){ pushable_socket.executeAsGM("moveAsGM", updates); }

  return res.valid || game.user.isGM;
});

Hooks.once("init", () => {    
  game.settings.register("pushable", "pull", {
    name: Lang('PullTitle'),
    hint: Lang('PullHint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register("pushable", "collideWithNonPushables", {
    name: Lang('collideWithNonPushables'),
    hint: Lang('collideWithNonPushablesHint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register("pushable", "showHints", {
    name: Lang('ShowHintsTitle'),
    hint: Lang('ShowHintsText'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register("pushable", "max_depth", {
    name: Lang("MaxDepth"),
    hint: Lang("MaxHint"),
    scope: 'world',
    config: true,
    type: Number,
    default: -1
  });
  game.keybindings.register("pushable", "pull_key", {
    name: Lang('PullKey'),
    hint: Lang("PullKeyHint"),
    editable: [{ key: 'KeyP' }],
    restricted: false,
    precedence: foundry.CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});

function createCheckBox(app, fields, data_name, title, hint){  
  const label = document.createElement('label');
  label.textContent = title; 
  const input = document.createElement("input");
  input.name = 'flags.' + MOD_NAME + '.' + data_name;
  input.type = "checkbox";
  input.title = hint;
  input.checked = !!app.token.getFlag(MOD_NAME, data_name);
  fields.append(label);
  fields.append(input);
}

Hooks.on("renderTokenConfig", (app, html) => {
  if (!game.user.isGM) return;

  const formGroup = document.createElement("div");
  formGroup.classList.add("form-group", "slim");
  const label = document.createElement("label");
  label.textContent = Lang("Pushable");
  formGroup.prepend(label);

  const formFields = document.createElement("div");
  formFields.classList.add("form-fields");
  formGroup.append(formFields);

  createCheckBox(app, formFields, 'isPushable', Lang('Pushable'), '');
  createCheckBox(app, formFields, 'isPullable', Lang('Pullable'), '');

  html.querySelector("footer.form-footer").before(formGroup);
  app.setPosition();
});
