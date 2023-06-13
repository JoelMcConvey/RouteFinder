import { useEffect, useRef, useState } from 'react';
import * as tt from '@tomtom-international/web-sdk-maps';
import * as tts from '@tomtom-international/web-sdk-services';
import '@tomtom-international/web-sdk-maps/dist/maps.css'
import './App.css';

function App() {
  const mapElement = useRef();
  const lngLatForm = useRef(null);
  const [map, setMap] = useState({});
  const [longitude, setLongitude] = useState(-5.9300);
  const [latitude, setLatitude] = useState(54.5958);

  const handleFormSubmit = () => {
    const form = lngLatForm.current;
    if (form['latitude'].value >= -90 && form['latitude'].value <= 90 && form['longitude'].value >= -90 && form['longitude'].value <= 90) {
      setLatitude(form['latitude'].value);
      setLongitude(form['longitude'].value);
    } else {
      alert("Longitude & Latitude Must Be:\n1. Greater Than and Equal To -90 and,\n2.Less Than and Equal To 90");
    }
  }

  const refreshMap = () => {
    window.location.reload();
  }

  const convertToPoints = (lngLat) => {
    return {
      point: {
        latitude: lngLat.lat,
        longitude: lngLat.lng
      }
    }
  }

  const drawRoute = (geoJson, map) => {
    if (map.getLayer('route')) {
      map.removeLayer('route')
      map.removeSource('route')
    }
    map.addLayer({
      id: 'route',
      type: 'line',
      source: {
        type: 'geojson',
        data: geoJson
      },
      paint: {
        'line-color': 'rgba(215, 89, 89, 0.6)',
        'line-width': 6
      }
    })
  }

  const addDeliveryMarker = (lngLat, map) => {
    if (document.getElementsByClassName('marker-delivery').length > 0) {
      const removeElem = document.getElementsByClassName('marker-delivery');
      removeElem[0].remove();
    }
    const element = document.createElement('div')
    element.className = 'marker-delivery';
    new tt.Marker({
      element: element
    })
      .setLngLat(lngLat)
      .addTo(map)
  }

  useEffect(() => {
    if(window.navigator.geolocation){
      navigator.geolocation.getCurrentPosition((position) => {
        let userLat = position.coords.latitude;
        let userLong = position.coords.longitude;

        setLatitude(userLat);
        setLongitude(userLong);
      })      
    }
    
    const origin = {
      lng: longitude,
      lat: latitude
    }
    let destinations = [];

    let map = tt.map({
      key: process.env.REACT_APP_TT_API_KEY,
      container: mapElement.current,
      stylesVisibility: {
        trafficIncidents: true,
        trafficFlow: true,
      },
      center: [longitude, latitude],
      zoom: 14,
    })

    setMap(map);

    const addMarker = () => {

      const popupOffset = {
        bottom: [0, -25]
      };
      const popup = new tt.Popup({ offset: popupOffset }).setHTML('Here You Are!');
      const element = document.createElement('div');
      element.className = 'marker';

      const marker = new tt.Marker({
        draggable: true,
        element: element
      })
        .setLngLat([longitude, latitude])
        .addTo(map)

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat()
        setLongitude(lngLat.lng)
        setLatitude(lngLat.lat)
      })

      marker.setPopup(popup).togglePopup()
    }

    addMarker();

    const sortDestinations = (locations) => {
      const pointsForDestinations = locations.map((destination) => {
        return convertToPoints(destination);
      })
      const callParameters = {
        key: process.env.REACT_APP_TT_API_KEY,
        destinations: pointsForDestinations,
        origins: [convertToPoints(origin)],
      }
      return new Promise((resolve, reject) => {
        tts.services.matrixRouting(callParameters)
          .then((matrixAPIResults) => {
            const results = matrixAPIResults.matrix[0]
            const resultsArray = results.map((result, index) => {
              return {
                location: locations[index],
                drivingtime: result.response.routeSummary.travelTimeInSeconds,
              }
            })
            resultsArray.sort((a, b) => {
              return a.drivingtime - b.drivingtime
            })
            const sortedLocations = resultsArray.map((result) => {
              return result.location
            })
            resolve(sortedLocations)
          })
      })
    }

    const recalculateRoutes = () => {
      sortDestinations(destinations).then((sorted) => {
        sorted.unshift(origin)

        tts.services
          .calculateRoute({
            key: process.env.REACT_APP_TT_API_KEY,
            locations: sorted
          })
          .then((routeData) => {
            const geoJson = routeData.toGeoJson()
            drawRoute(geoJson, map)
          })
      })
    }

    map.on('click', (e) => {
      destinations = [];
      destinations.push(e.lngLat);
      addDeliveryMarker(e.lngLat, map)
      recalculateRoutes()
    })

    return () => map.remove();
  }, [longitude, latitude]);

  return (
    <>
      {map && <div className="App">
        <h1>Get From A To B</h1>
        <div className="search-bar">
          <p>Update Your Location:</p>
          <form ref={lngLatForm}>
            <input
              type="text"
              id="newLongitude"
              className="longitude"
              name="longitude"
              placeholder="Current Longitude"
            />
            <input
              type="text"
              id="newLatitude"
              className="latitude"
              name="latitude"
              placeholder="Current Latitude"
            />
          </form>
          <button
            className="button"
            onClick={handleFormSubmit}
          >
            Submit</button>
        </div>
        <div ref={mapElement} className="map" />
        <div className="refresh-section">
          <button
            className="refresh"
            onClick={refreshMap}
          >
            Refresh Map</button>
        </div>
      </div>}
    </>
  );
}

export default App;
