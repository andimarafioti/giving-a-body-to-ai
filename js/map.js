// WORLD MAP: coastlines (equirectangular, 10 user units per degree), a pin on Bordeaux
// for the Pollen slide, dots for the community slide; the view zooms between the two.
(async () => {
    const xy = (lat, lon) => [(lon + 180) * 10, (90 - lat) * 10];
    const coast = await fetch('assets/world-coast.json', { cache: 'no-cache' }).then(r => r.json());
    const d = coast.lines.map(l => {
        let out = '';
        for (let i = 0; i < l.length; i += 2) { const [x, y] = xy(l[i] / coast.scale, l[i + 1] / coast.scale); out += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); }
        return out;
    }).join('');
    document.getElementById('mapCoast').innerHTML = `<path d="${d}"/>`;
    // Community dots: cities on every continent (illustrative, not a shipping map).
    const CITIES = [[44.84, -0.58], [48.86, 2.35], [51.51, -0.13], [52.52, 13.4], [40.42, -3.7], [41.9, 12.5], [59.33, 18.07], [50.85, 4.35], [47.37, 8.54], [52.37, 4.9],
        [40.71, -74.0], [37.77, -122.42], [34.05, -118.24], [47.61, -122.33], [41.88, -87.63], [43.65, -79.38], [45.5, -73.57], [30.27, -97.74], [19.43, -99.13], [42.36, -71.06],
        [-23.55, -46.63], [-34.6, -58.38], [4.71, -74.07], [-33.45, -70.67], [35.68, 139.69], [37.57, 126.98], [31.23, 121.47], [22.32, 114.17], [1.35, 103.82], [25.03, 121.57],
        [12.97, 77.59], [19.08, 72.88], [28.61, 77.21], [25.2, 55.27], [32.09, 34.78], [41.01, 28.98], [-33.87, 151.21], [-37.81, 144.96], [-36.85, 174.76], [-26.2, 28.05],
        [6.52, 3.38], [-1.29, 36.82], [30.04, 31.24], [55.75, 37.62], [50.45, 30.52], [60.17, 24.94], [53.35, -6.26], [38.72, -9.14], [45.46, 9.19], [43.3, 5.37],
        [48.14, 11.58], [50.11, 8.68], [53.55, 9.99], [45.76, 4.84], [43.6, 1.44], [47.22, -1.55], [50.63, 3.06], [48.58, 7.75], [51.92, 4.48], [51.22, 4.4], [46.2, 6.14], [46.95, 7.45], [48.21, 16.37], [50.08, 14.44], [52.23, 21.01], [47.5, 19.04], [55.68, 12.57], [59.91, 10.75], [53.48, -2.24], [55.95, -3.19], [51.45, -2.59], [41.39, 2.17], [39.47, -0.38], [45.07, 7.69], [40.85, 14.27], [43.77, 11.25], [37.98, 23.73], [44.43, 26.1], [54.69, 25.28], [56.95, 24.11], [58.38, 26.72], [60.39, 5.32], [57.71, 11.97], [50.94, 6.96], [49.45, 11.08], [47.07, 15.44], [52.37, 9.73],
        [33.75, -84.39], [29.76, -95.37], [32.78, -96.8], [39.74, -104.99], [33.45, -112.07], [32.72, -117.16], [45.52, -122.68], [36.17, -115.14], [44.98, -93.27], [39.95, -75.17], [38.91, -77.04], [40.44, -79.99], [42.33, -83.05], [39.1, -84.51], [39.77, -86.16], [38.63, -90.2], [39.1, -94.58], [36.16, -86.78], [35.23, -80.84], [35.78, -78.64], [25.76, -80.19], [28.54, -81.38], [27.95, -82.46], [29.95, -90.07], [40.76, -111.89], [37.34, -121.89], [38.58, -121.49], [43.04, -76.14], [42.89, -78.88], [41.82, -71.41], [43.66, -70.26], [35.08, -106.65], [49.28, -123.12], [51.05, -114.07], [43.07, -89.4]];
    document.getElementById('mapDots').innerHTML = CITIES.map(([la, lo], i) => { const [x, y] = xy(la, lo); return `<circle cx="${x}" cy="${y}" r="9" style="--i:${i}"/>`; }).join('');

    // Views: stage position of a map point at a zoom. The svg is 1920x960 at top 60 (0.5333 px/unit).
    const PX = 1920 / 3600, TOP = 60;
    const VIEWS = { pollen: { lat: 46.5, lon: 2, at: [470, 330], zoom: 5.5 }, users: { lat: 46.5, lon: 2, at: [1400, 520], zoom: 5.5 }, community: { lat: 10, lon: 10, at: [1013, 620], zoom: 1.05 },
        about: { lat: 5, lon: -22, at: [640, 560], zoom: 1.15 } }; // Buenos Aires and Vienna, left of the about panel
    const view = document.getElementById('mapView'), pins = document.querySelectorAll('.map-pin');
    const apply = id => {
        const v = VIEWS[id] ?? VIEWS.community;
        const [x, y] = xy(v.lat, v.lon);
        const tx = v.at[0] / PX - v.zoom * x, ty = (v.at[1] - TOP) / PX - v.zoom * y;
        view.style.transform = `translate(${tx}px, ${ty}px) scale(${v.zoom})`;
        for (const pin of pins) {
            const [bx, by] = xy(...pin.dataset.at.split(' ').map(Number));
            pin.style.left = `${(tx + v.zoom * bx) * PX}px`; pin.style.top = `${(ty + v.zoom * by) * PX + TOP}px`;
        }
    };
    apply(window.deck.scene().id);
    addEventListener('slidechange', e => apply(e.detail.id));
})();
