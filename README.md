# Svelte Content Loader for Svelte 3

[![NPM version](https://img.shields.io/npm/v/svelte-content-loader.svg?style=flat)](https://www.npmjs.com/package/svelte-content-loader) [![NPM downloads](https://img.shields.io/npm/dm/svelte-content-loader.svg?style=flat)](https://www.npmjs.com/package/svelte-content-loader)

SVG component to create placeholder loading, like Facebook cards loading.

![preview](https://user-images.githubusercontent.com/4838076/34308760-ec55df82-e735-11e7-843b-2e311fa7b7d0.gif)

## Features

This is a Svelte port for [vue-content-loader](https://github.com/egoist/vue-content-loader).

- Completely customizable: you can change the colors, speed and sizes.
- You can use it right now: there are a lot of presets already.
- Performance:
  - Tree-shakable and highly optimized bundle.
  - Pure SVG, so it's works without any javascript, canvas, etc.
  - Vanilla JS components.

## Install

```bash
npm i svelte-content-loader --save
```

```bash
yarn add svelte-content-loader
```

CDN: [UNPKG](https://unpkg.com/svelte-content-loader/) | [jsDelivr](https://cdn.jsdelivr.net/npm/svelte-content-loader/) (available as `window.ContentLoader`)

## Usage

```html
<ContentLoader/>

<script>
import ContentLoader from 'svelte-content-loader';
</script>
```

### Built-in loaders

```js
import {
  FacebookLoader,
  CodeLoader,
  BulletListLoader,
  InstagramLoader,
  ListLoader
} from 'svelte-content-loader'
```

`ContentLoader` is a meta loader while other loaders are just higher-order components of it. By default `ContentLoader` only displays a simple rectangle, here's how you can use it to create custom loaders:

```html
<ContentLoader>
  <rect x="0" y="0" rx="3" ry="3" width="250" height="10" />
  <rect x="20" y="20" rx="3" ry="3" width="220" height="10" />
  <rect x="20" y="40" rx="3" ry="3" width="170" height="10" />
  <rect x="0" y="60" rx="3" ry="3" width="250" height="10" />
  <rect x="20" y="80" rx="3" ry="3" width="200" height="10" />
  <rect x="20" y="100" rx="3" ry="3" width="80" height="10" />
</ContentLoader>
```

This is also how [ListLoader](./src/ListLoader.svelte) is created.

If you are **not** using using es6, instead of importing add 

```html
<script src="/path/to/svelte-content-loader/index.js"></script>
```

just before closing body tag. 

## API

### Props

|Name|Type|Default|Description|
|---|---|---|---|
|width|number|`400`||
|height|number|`130`||
|speed|number|`2`||
|preserveAspectRatio|string|`'xMidYMid meet'`||
|primaryColor|string|`'#f9f9f9'`||
|secondaryColor|string|`'#ecebeb'`||
|uniqueKey|string|`randomId()`|Unique ID, you need to make it consistent for SSR|
|animate|boolean|`true`||
|baseUrl|string|empty string|Required if you're using <base url="/" /> in your <head/>. Defaults to an empty string. This prop is common used as: <ContentLoader bind:baseUrl={pathname} /> which will fill the SVG attribute with the relative path.
|primaryOpacity|number|`1`|Background opacity (0 = transparent, 1 = opaque) used to solve an issue in Safari|
|secondaryOpacity|number|`1`|Background opacity (0 = transparent, 1 = opaque) used to solve an issue in Safari|


## Credits

This is basically a Svelte port for [vue-content-loader](https://github.com/egoist/vue-content-loader).

## License

MIT &copy; [PaulMaly](https://github.com/PaulMaly)