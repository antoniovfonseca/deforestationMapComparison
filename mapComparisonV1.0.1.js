/******************************************************************************
 * Author         : Antonio Fonseca
 * Institution    : Clark University
 * Contact        : antfonseca@clarku.edu
 * Version        : Code Version 1.0.1
 * Description    : 
 *   This script performs raster map comparison pixel by pixel for a time series
 *   from 2008 to 2023, including statistics and export for each year.
 ******************************************************************************/

/******************************************************************************
 * STEP 1: SET ASSET
 * - Define the asset of your maps.
 ******************************************************************************/

// Set time series
var yearT0 = 2008;
var yearT1 = 2023;

// Set the Region of Interest (ROI)
var roiAsset = "projects/antfonseca/assets/assessment/aaas2025/amazonMask";

// Set the Reference Map
var referenceAsset = "projects/antfonseca/assets/assessment/aaas2025/defReference";

// Set the Map A
var mapAasset = "projects/antfonseca/assets/assessment/aaas2025/defMapA";

// Set the Map B
var mapBasset = "projects/antfonseca/assets/assessment/aaas2025/defMapB";

// Set the Google Drive folder output
var folder = "MAP COMPARISON TEST";

// Set the asset output
var assetOutput = "projects/antfonseca/assets/assessment/aaas2025/mapComparison/";

/******************************************************************************
 * STEP 2: LOAD MAPS
 * - Load and import the maps that will be used for map comparison.
 ******************************************************************************/

// Read the ROI mask
var roi = ee.Image(roiAsset)
    .selfMask();

// Read Reference Map and apply the ROI mask
var reference = ee.Image(referenceAsset)
    .mask(roi)
    .selfMask();

// Read Map A and apply the ROI mask
var mapA = ee.Image(mapAasset)
    .mask(roi)
    .selfMask();

// Read Map B and apply the ROI mask
var mapB = ee.Image(mapBasset)
    .mask(roi)
    .selfMask();

/******************************************************************************
 * STEP 3: LOOP THROUGH YEARS FOR MAP COMPARISON
 ******************************************************************************/

for (var year = yearT0; year <= yearT1; year++) {
  // Map Comparison A
  var comparisonA = reference.eq(year).multiply(10).unmask()
      .add(mapA.eq(year).unmask())
      .mask(roi);

  comparisonA = comparisonA.remap([0,
                                   1,  // Only Map A
                                   10, // Only Reference
                                   11],// Agreement
                                   [0,
                                   1,  // False Alarm
                                   2,  // Miss
                                   3   // Hit
                                   ])
                           .rename("comparison");

  // Map Comparison B
  var comparisonB = reference.eq(year).multiply(10).unmask()
      .add(mapB.eq(year).unmask())
      .mask(roi)
      .rename("comparison");

  comparisonB = comparisonB.remap([0,
                                   1,  // Only Map B
                                   10, // Only Reference
                                   11],// Agreement
                                   [0,
                                   1,  // False Alarm
                                   2,  // Miss
                                   3   // Hit
                                   ])
                            .rename("comparison");

  /******************************************************************************
   * STEP 4: STATISTICS
   ******************************************************************************/

  // Pixel count map comparison A
  var pixelCountsA = comparisonA.selfMask().reduceRegion({
      'reducer': ee.Reducer.frequencyHistogram(),
      'geometry': reference.geometry(),
      'scale': 30,
      'maxPixels': 1e13
  });

  // Extract the histogram from map comparison A and convert to a feature collection
  var pixelCountDictA = ee.Dictionary(pixelCountsA.get('comparison'));
  var keysA = pixelCountDictA.keys();
  var featuresA = keysA.map(function(keysA) {
    return ee.Feature(null, {'class': keysA, 'count': pixelCountDictA.get(keysA)});
  });
  var featureCollectionA = ee.FeatureCollection(featuresA);

  // Pixel count map comparison B
  var pixelCountsB = comparisonB.selfMask().reduceRegion({
      'reducer': ee.Reducer.frequencyHistogram(),
      'geometry': reference.geometry(),
      'scale': 30,
      'maxPixels': 1e13
  });

  // Extract the histogram from map comparison B and convert to a feature collection
  var pixelCountDictB = ee.Dictionary(pixelCountsB.get('comparison'));
  var keysB = pixelCountDictB.keys();
  var featuresB = keysB.map(function(keysB) {
    return ee.Feature(null, {'class': keysB, 'count': pixelCountDictB.get(keysB)});
  });
  var featureCollectionB = ee.FeatureCollection(featuresB);

  /******************************************************************************
   * STEP 5: EXPORT
   ******************************************************************************/

  // Export Raster Map Comparison A to asset
  Export.image.toAsset({
    'image': comparisonA.set("year", year).set("map", "A"),
    'description': "comparisonA_" + year + "_to_asset",
    'assetId': assetOutput + "mapComparisonA_" + year,
    'region': reference.geometry(),
    'scale': 30,
    'pyramidingPolicy': { '.default': 'mode' },
    'maxPixels': 1e13
  });

  // Export the pixel number of Map Comparison A as a CSV file
  Export.table.toDrive({
    'collection': featureCollectionA,
    'description': 'pixelNumberComparisonA_' + year,
    'fileFormat': 'CSV',
    'folder': folder,
  });

  // Export Raster Map Comparison B to Google Drive
  Export.image.toDrive({
    'image': comparisonB.selfMask(),
    'description': 'mapComparisonB_' + year + '_to_drive',
    'scale': 30,
    'folder': folder,
    'region': reference.geometry(),
    'shardSize': 256,
    'maxPixels': 1e13
  });

  // Export Raster Map Comparison B to asset
  Export.image.toAsset({
    'image': comparisonB.set("year", year).set("map", "B"),
    'description': "comparisonB_" + year + "_to_asset",
    'assetId': assetOutput + "mapComparisonB_" + year,
    'region': reference.geometry(),
    'scale': 30,
    'pyramidingPolicy': { '.default': 'mode' },
    'maxPixels': 1e13
  });

  // Export the pixel number of Map Comparison B as a CSV file
  Export.table.toDrive({
    'collection': featureCollectionB,
    'description': 'pixelNumberComparisonB_' + year,
    'fileFormat': 'CSV',
    'folder': folder,
  });
}

/******************************************************************************
 * STEP 6: Layers
 * - Add layers to the map for visualization.
 ******************************************************************************/

Map.addLayer(reference.selfMask(), {'min': 2008, 'max': 2023,
                                    'palette': ['yellow', 'orange', 'red']},
                                    'Reference Map', false);

Map.addLayer(mapA.selfMask(), {'min': 2008, 'max': 2023,
                               'palette': ['yellow', 'orange', 'red']},
                               'Map A', false);

Map.addLayer(mapB.selfMask(), {'min': 2008, 'max': 2023,
                               'palette': ['yellow', 'orange', 'red']},
                               'Map B', false);

Map.setOptions('SATELLITE');
