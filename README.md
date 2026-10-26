# Giving a body to AI

Andi Marafioti's talk on Reachy Mini, Microduck and robots you can talk to (Hugging Face), built on
Fabien Danieau's Reachy Mini deck: https://github.com/FabienDanieau/reachy_mini_intro (CC BY 4.0).

Changes from Fabien's deck: the slides and their content; `data-scene="id.step"` so any slide can reuse a
camera shot; speaker notes (N); keynote mode (K) that skips the slides marked "Keynote: cut"; Hugging Face
accent colours; the light theme switch removed. See HOW-TO-PRESENT.txt to run it.

## Licence and credits

The slides, layout and code are shared under CC BY 4.0, like Fabien's deck they adapt.

Photos and video clips in `media/` belong to their owners and are only shown to illustrate the talk; they are not
covered by the licence: Pollen Robotics and Hugging Face (Microduck, Reachy Mini and Reachy 2 clips, community
photos collected by Fabien Danieau), Chris Paxton (quadruped clip, from his post on X), and press and product photos
of other robots. The robot models and motion data keep their own licences, listed below.

Fabien's original README follows.

---

# Reachy Mini intro

The slides of a talk on Reachy Mini, the open-source desktop robot by Pollen Robotics and Hugging Face,
first given at Proto Robot #0 (Prague, 23 October 2026). An HTML deck with live three.js robots.

Live at https://fabiendanieau.github.io/reachy_mini_intro/ (deployed from `main` by `.github/workflows/pages.yml`).

A PDF of every slide and step, for printing or plain display: [`reachy_mini_intro.pdf`](reachy_mini_intro.pdf).

To run it locally, serve it over HTTP (it fetches its slides and ES modules), then open the URL it prints:

    uv run --no-project python serve.py

`#N` jumps to slide N, `#3.2` to step 2 of slide 3. `T` (or the faint button top right) switches to a light
theme for bright rooms. Everything is local, so it runs without a network.

- `slides/<id>.html`: one file per slide, the text to edit; their order is the list in `index.html`.
- `deck.css`: styles. `js/`: navigation, theme, world map, growth chart and the 3D scene.
- `assets/`: robot models, clips and media; `assets/vendor/`: three.js r180, the Draco decoder, the fonts.

Binary assets are in Git LFS.

## License

The text, code and layout are © Fabien Danieau, under CC BY 4.0.

The robot models and motion data come from open-source repositories and keep their own licenses. They are
redistributed here, some modified (decimated meshes, baked animation clips, merged parts):

| Asset | Source | License |
|---|---|---|
| Reachy Mini model (`reachy_mini_viz.glb`), by Clément Plays | [reachy_mini_blender](https://github.com/pollen-robotics/reachy_mini_blender), exported with its `export_gltf.py` | Apache-2.0 |
| Reachy Mini rig code (`assets/robot.js`) | [reachy-mini-yo-its-your-boy](https://huggingface.co/spaces/pollen-robotics/reachy-mini-yo-its-your-boy) Space | Apache-2.0 |
| Reachy 2 (`reachy2.glb`), with a grasp clip | [reachy2-blender](https://github.com/pollen-robotics/reachy2-blender) | Apache-2.0 |
| Reachy 1 (`reachy1.glb`) | [reachy-blender](https://github.com/pollen-robotics/reachy-blender) | **CC BY-SA 4.0** |
| Amazing Hands (`assets/robots/hand*`) | [AmazingHand](https://github.com/pollen-robotics/AmazingHand) | Apache-2.0 |
| Gripette on OpenArm, Grabette (`assets/robots/gripette`, `grabette`) | [grabette](https://github.com/pollen-robotics/grabette), [OpenArm](https://github.com/enactic/openarm) | Apache-2.0 |
| Microduck (`assets/robots/duck`) | [microduck](https://github.com/pollen-robotics/microduck) | Apache-2.0 |
| Emotions and dances (`assets/moves.json`) | [emotions](https://huggingface.co/datasets/pollen-robotics/reachy-mini-emotions-library) and [dances](https://huggingface.co/datasets/pollen-robotics/reachy-mini-dances-library) libraries | Apache-2.0 |

`reachy1.glb` is a modified version of a CC BY-SA 4.0 model, so it is shared under CC BY-SA 4.0 too.
`assets/vendor/` holds three.js (MIT), the Draco decoder (Apache-2.0) and the fonts (SIL Open Font License).

Logos, video thumbnails, photos and paper figures belong to their owners and are only shown to illustrate the
talk; they are not covered by the licenses above.
