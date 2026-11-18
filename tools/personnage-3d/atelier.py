# Production des calques du personnage réaliste (MakeHuman CC0, Blender Cycles).
# Pour chaque corps (base × musculature × masse grasse) : 6 peaux, les tenues, les coiffures, en PNG transparents superposables.
# Usage : python atelier.py lot.json   (lot = liste de corps ; les fichiers déjà faits sont sautés)
import bpy, sys, json, importlib, math, os
from mathutils import Vector
L = json.load(open(sys.argv[1])); S = json.load(open("/home/claude/rendu/reglages.json")); OUT = "/home/claude/rendu/calques2"
bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
def imp(pkg, key):
    for m in list(sys.modules):
        if m.endswith(pkg): return getattr(importlib.import_module(m), key)
HS = imp("mpfb.services.humanservice", "HumanService"); AS = imp("mpfb.services.assetservice", "AssetService")
TS = imp("mpfb.services.targetservice", "TargetService"); HOP = imp("mpfb.entities.objectproperties", "HumanObjectProperties")
OS = imp("mpfb.services.objectservice", "ObjectService")
P = lambda nom, sous: AS.find_asset_absolute_path(nom, asset_subdir=sous)

def scene_commune(h):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = S["samples"]; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = S["res"]; sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Base Contrast"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.08, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    def lum(nom, loc, e, taille, couleur):
        l = bpy.data.lights.new(nom, "AREA"); l.energy = e; l.size = taille; l.color = couleur
        o = bpy.data.objects.new(nom, l); sc.collection.objects.link(o); o.location = loc
        d = o.constraints.new("TRACK_TO"); d.target = h; d.track_axis = "TRACK_NEGATIVE_Z"; d.up_axis = "UP_Y"
    lum("cle", (-2.4, -2.6, 2.8), 650, 1.6, (1, 0.95, 0.88)); lum("remplissage", (2.8, -2.8, 1.2), 90, 3.5, (0.8, 0.88, 1))
    lum("contre_g", (-1.8, 2.4, 2.6), 500, 0.8, (0.75, 0.85, 1)); lum("contre_d", (1.8, 2.4, 2.6), 500, 0.8, (1, 0.85, 0.6))
    # Cadrage fixe pour tous les corps (mêmes pixels pour la tête et les pieds : les calques se superposent)
    z = S["hauteur_cadre"]
    cam = bpy.data.cameras.new("cam"); cam.lens = 85; cam.sensor_fit = "VERTICAL"; cam.sensor_height = 24
    co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    dist = (z * 1.08 / 2) / math.tan(math.atan(12 / 85)); co.location = (0, -dist, z * 0.55)
    cible = bpy.data.objects.new("cible", None); sc.collection.objects.link(cible); cible.location = (0, 0, z * 0.5)
    t = co.constraints.new("TRACK_TO"); t.target = cible; t.track_axis = "TRACK_NEGATIVE_Z"; t.up_axis = "UP_Y"
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0)); bpy.context.active_object.is_shadow_catcher = True
    return sc

def poser(rig):
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode="POSE")
    ec, av, fl = 0.2, 0.06, 0.18
    def orienter(nom, cible):
        b = rig.pose.bones.get(nom); b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(b.bone.matrix_local.to_3x3().inverted() @ Vector(cible).normalized()); bpy.context.view_layer.update()
    def suivre(nom, cible):
        b = rig.pose.bones.get(nom); b.rotation_mode = "QUATERNION"; bpy.context.view_layer.update()
        m = rig.matrix_world.to_3x3() @ b.matrix.to_3x3(); q = (m @ Vector((0, 1, 0))).normalized().rotation_difference(Vector(cible).normalized())
        b.rotation_quaternion = b.rotation_quaternion @ (b.matrix.to_3x3().inverted() @ q.to_matrix() @ b.matrix.to_3x3()).to_quaternion(); bpy.context.view_layer.update()
    orienter("upperarm01.L", (ec, -av, -1)); orienter("upperarm01.R", (-ec, -av, -1))
    suivre("lowerarm01.L", (ec * 0.8, -av - fl, -1)); suivre("lowerarm01.R", (-ec * 0.8, -av - fl, -1))
    bpy.ops.object.mode_set(mode="OBJECT")

def rendre(sc, chemin, visibles, caches):
    if os.path.exists(chemin): return
    for o in sc.objects:
        if o.type != "MESH" or o.is_shadow_catcher: continue
        k = o.get("_calque")
        o.hide_render = k not in visibles and k not in caches
        o.is_holdout = k in caches
    sc.render.filepath = chemin; bpy.ops.render.render(write_still=True); print("OK", chemin, flush=True)

for c in L:
    nom = f'{c["base"]}-m{c["mu"]}-g{c["mg"]}'
    if all(os.path.exists(f"{OUT}/{d}/{nom}-{x}.png") for d, xs in (("corps", S["peaux"]), ("tenue", S["tenues"][c["base"]]), ("cheveux", S["coiffures"])) for x in xs): continue
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
    h = HS.create_human()
    for k, v in {**S["bases"][c["base"]], "muscle": S["muscle"][c["mu"]], "weight": S["graisse"][c["base"]][c["mg"]]}.items(): HOP.set_value(k, v, entity_reference=h)
    TS.reapply_macro_details(h)
    # Cibles locales en plus des réglages globaux : musculature et masse grasse bien plus marquées
    TD = "/root/.config/blender/5.3/extensions/user_default/mpfb/data/targets"
    def cible(chemin, poids):
        if poids > 0: TS.load_target(h, f"{TD}/{chemin}.target.gz", weight=poids)
    km, kg = S["muscle_local"][c["mu"]], S["graisse_local"][c["mg"]]
    for cote in "lr":
        for z in ("upperarm-muscle", "upperarm-shoulder-muscle", "lowerarm-muscle"): cible(f"arms/{cote}-{z}-incr", km)
        for z in ("upperleg-muscle", "lowerleg-muscle"): cible(f"legs/{cote}-{z}-incr", km)
        for z in ("upperarm-fat", "lowerarm-fat"): cible(f"arms/{cote}-{z}-{'incr' if kg >= 0 else 'decr'}", abs(kg))
        for z in ("upperleg-fat", "lowerleg-fat"): cible(f"legs/{cote}-{z}-{'incr' if kg >= 0 else 'decr'}", abs(kg))
    cible("torso/torso-muscle-dorsi-incr", km); cible("torso/torso-muscle-pectoral-incr", km * 0.8)
    cible("neck/neck-scale-horiz-incr", km * 0.5)
    cible("stomach/stomach-pregnant-incr", max(0, kg) * 0.6); cible("stomach/stomach-tone-incr" if kg < 0.3 else "stomach/stomach-tone-decr", 0.6)
    cible("hip/hip-scale-horiz-incr", max(0, kg) * 0.4); cible("buttocks/buttocks-volume-incr", max(0, kg) * 0.4)
    cible("neck/neck-double-incr", max(0, kg - 0.5))
    rig = HS.add_builtin_rig(h, "default")
    HS.set_character_skin(P(list(S["peaux"].values())[0][c["base"]], "skins"), h, skin_type="ENHANCED_SSS")
    for sous, f, t in [("eyes", "low-poly.mhclo", "Eyes"), ("eyebrows", "eyebrow001.mhclo", "Eyebrows"), ("eyelashes", "eyelashes01.mhclo", "Eyelashes"), ("teeth", "teeth_base.mhclo", "Teeth")]:
        HS.add_mhclo_asset(P(f, sous), h, asset_type=t, subdiv_levels=0)["_calque"] = "corps"
    h["_calque"] = "corps"
    masques = {}
    for tid, pieces in S["tenues"][c["base"]].items():
        avant = {m.name for m in h.modifiers}
        for f in pieces: HS.add_mhclo_asset(P(f, "clothes"), h, asset_type="Clothes", subdiv_levels=1)["_calque"] = "tenue:" + tid
        masques[tid] = [m.name for m in h.modifiers if m.name not in avant and m.type == "MASK"]
    for cid, f in S["coiffures"].items():
        if f: HS.add_mhclo_asset(P(f, "hair"), h, asset_type="Hair", subdiv_levels=0)["_calque"] = "cheveux:" + cid
    # Le corps reste entier sous les vêtements (pas de parties retirées) : chaque calque doit tenir seul
    for m in h.modifiers:
        if m.type == "MASK" and m.name not in ("Hide helpers", "Hide base mesh"): m.show_render = False; m.show_viewport = False
    sm = h.modifiers.new("lisse", "SUBSURF"); sm.levels = 1; sm.render_levels = 1
    poser(rig)
    sc = scene_commune(h)
    for d in ("corps", "tenue", "cheveux"): os.makedirs(f"{OUT}/{d}", exist_ok=True)
    for pid, fichiers in S["peaux"].items():
        if os.path.exists(f"{OUT}/corps/{nom}-{pid}.png"): continue
        HS.set_character_skin(P(fichiers[c["base"]], "skins"), h, skin_type="ENHANCED_SSS")
        rendre(sc, f"{OUT}/corps/{nom}-{pid}.png", ["corps"], [])
    # Calque tenue : le corps sert de cache, mais sans les zones couvertes par cette tenue (sinon la peau perce le tissu)
    for tid in S["tenues"][c["base"]]:
        for m in h.modifiers:
            if m.type == "MASK" and m.name not in ("Hide helpers", "Hide base mesh"): m.show_render = m.name in masques[tid]
        rendre(sc, f"{OUT}/tenue/{nom}-{tid}.png", ["tenue:" + tid], ["corps"])
    for m in h.modifiers:
        if m.type == "MASK" and m.name not in ("Hide helpers", "Hide base mesh"): m.show_render = False
    for cid, f in S["coiffures"].items():
        if f: rendre(sc, f"{OUT}/cheveux/{nom}-{cid}.png", ["cheveux:" + cid], ["corps"])
