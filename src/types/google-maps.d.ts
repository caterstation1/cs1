declare global {
  interface Window {
    google: typeof google
  }
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: HTMLElement, opts?: MapOptions)
      setCenter(latLng: LatLng): void
      setZoom(zoom: number): void
      fitBounds(bounds: LatLngBounds): void
    }

    class Marker {
      constructor(opts?: MarkerOptions)
      setMap(map: Map | null): void
      getPosition(): LatLng
      addListener(eventName: string, handler: Function): void
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions)
      open(map?: Map, anchor?: Marker): void
    }

    class LatLng {
      constructor(lat: number, lng: number)
    }

    class LatLngBounds {
      constructor()
      extend(latLng: LatLng): void
    }

    class Size {
      constructor(width: number, height: number)
    }

    class Point {
      constructor(x: number, y: number)
    }

    interface MapOptions {
      center?: LatLng
      zoom?: number
      styles?: MapTypeStyle[]
    }

    interface MarkerOptions {
      position?: LatLng
      map?: Map
      title?: string
      icon?: MarkerIcon
    }

    interface InfoWindowOptions {
      content?: string
    }

    interface MarkerIcon {
      url?: string
      scaledSize?: Size
      anchor?: Point
    }

    interface MapTypeStyle {
      featureType?: string
      elementType?: string
      stylers?: Array<{ [key: string]: any }>
    }
  }
}

export {} 