// Burn severity (dNBR) for the Camp Fire, Paradise CA, Nov 2018
// Data: Landsat 8 Collection 2 Level 2 (surface reflectance)
// Made by James Caravetta (CaravettaGIS)

//SETTINGS (can be changed to map a different fire)
var fireName = 'Camp Fire, Paradise CA (Nov 2018)';

// Official fire perimeter from MTBS (Monitoring Trends in Burn Severity).
var mtbsName = 'CAMP';   // MTBS incident name 
var nearby = ee.FeatureCollection('USFS/GTAC/MTBS/burned_area_boundaries/v1')
    .filterBounds(ee.Geometry.Point([-121.62, 39.76]));
var campFire = nearby.filter(ee.Filter.eq('Incid_Name', mtbsName));
var fireArea = campFire.geometry();


var preStart  = '2018-09-01';
var preEnd    = '2018-11-01';   // fire started Nov 8, 2018
var postStart = '2018-11-26';   // fire contained Nov 25, 2018
var postEnd   = '2018-12-31';   // widen this if the post-fire map has holes

// MAP HELPERS

// Mask clouds/shadows and convert raw values to surface reflectance
function prepLandsat8(image) {
  var qa = image.select('QA_PIXEL');
  var clear = qa.bitwiseAnd(1 << 1).eq(0)   // dilated cloud
      .and(qa.bitwiseAnd(1 << 3).eq(0))     // cloud
      .and(qa.bitwiseAnd(1 << 4).eq(0));    // cloud shadow
  var reflectance = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  return image.addBands(reflectance, null, true).updateMask(clear);
}

// Median of all clear pixels in a date range
function makeComposite(start, end) {
  return ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(fireArea)
      .filterDate(start, end)
      .map(prepLandsat8)
      .median()
      .clip(fireArea);
}

// NBR = (NIR - SWIR2) / (NIR + SWIR2)
// Landsat 8: NIR = SR_B5, SWIR2 = SR_B7
function calcNBR(image) {
  return image.normalizedDifference(['SR_B5', 'SR_B7']).rename('NBR');
}

// ANALYSIS
var pre  = makeComposite(preStart, preEnd);
var post = makeComposite(postStart, postEnd);

// dNBR = pre-fire NBR minus post-fire NBR (bigger = more severe)
var dNBR = calcNBR(pre).subtract(calcNBR(post)).rename('dNBR');

// Severity classes using the commonly used USGS dNBR thresholds
// 1 = unburned, 2 = low, 3 = moderate-low, 4 = moderate-high, 5 = high
var severity = ee.Image(1)
    .where(dNBR.gte(0.10), 2)
    .where(dNBR.gte(0.27), 3)
    .where(dNBR.gte(0.44), 4)
    .where(dNBR.gte(0.66), 5)
    .updateMask(dNBR.mask())
    .rename('severity');

// MAP
Map.centerObject(fireArea);

var trueColor = {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.3};
Map.addLayer(pre, trueColor, 'Pre-fire true color');
Map.addLayer(post, trueColor, 'Post-fire true color');

Map.addLayer(
    dNBR,
    {min: -0.25, max: 1.3, palette: ['white', 'yellow', 'orange', 'red', 'black']},
    'dNBR (continuous)',
    false);

Map.addLayer(
    severity,
    {min: 1, max: 5, palette: ['#1a9641', '#ffffb2', '#fecc5c', '#fd8d3c', '#e31a1c']},
    'Burn severity classes');

// Outline of the official MTBS perimeter
Map.addLayer(
    campFire.style({color: 'black', fillColor: '00000000', width: 2}),
    {},
    'MTBS perimeter');

//TITLE + LEGEND
var title = ui.Label({
  value: fireName + ': burn severity (dNBR)',
  style: {position: 'top-center', fontWeight: 'bold', fontSize: '16px'}
});
Map.add(title);

var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px 15px'}});
legend.add(ui.Label({
  value: 'Burn severity',
  style: {fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 0'}
}));

var classes = [
  {color: '#1a9641', label: 'Unburned (dNBR < 0.10)'},
  {color: '#ffffb2', label: 'Low (0.10 - 0.27)'},
  {color: '#fecc5c', label: 'Moderate-low (0.27 - 0.44)'},
  {color: '#fd8d3c', label: 'Moderate-high (0.44 - 0.66)'},
  {color: '#e31a1c', label: 'High (>= 0.66)'}
];

classes.forEach(function(c) {
  var swatch = ui.Label({style: {backgroundColor: c.color, padding: '8px', margin: '0 8px 4px 0'}});
  var text = ui.Label({value: c.label, style: {margin: '0 0 4px 0'}});
  legend.add(ui.Panel([swatch, text], ui.Panel.Layout.Flow('horizontal')));
});
Map.add(legend);

print(fireName);


// LIGHT GRAY CANVAS (kinda like Esri's)
var lightGray = [
  {elementType: 'geometry', stylers: [{color: '#f5f5f5'}]},
  {elementType: 'labels.icon', stylers: [{visibility: 'off'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#616161'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#f5f5f5'}]},
  {featureType: 'administrative.land_parcel', stylers: [{visibility: 'off'}]},
  {featureType: 'administrative.neighborhood', stylers: [{visibility: 'off'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#ffffff'}]},
  {featureType: 'road.arterial', elementType: 'labels', stylers: [{visibility: 'off'}]},
  {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#dadada'}]},
  {featureType: 'road.local', elementType: 'labels', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#c9c9c9'}]}
];
Map.setOptions('Light Gray', {'Light Gray': lightGray});


// CODE FOR GOOD SCREENSHOT (uncomment when running the code for a screenshot of the map)
// Map.setControlVisibility(null, false, false, true, false, false, false);
