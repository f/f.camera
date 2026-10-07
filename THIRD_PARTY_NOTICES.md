# Credits and third-party material

This theme is built with [Spacefast](https://spacefast.com) and
[Spacefast Zero](https://spacefast.com/docs/zero-runtime/). WordPress manages
the photo library and its metadata. [OpenStreetMap](https://www.openstreetmap.org/copyright)
provides the maps and geographic data, with attribution shown in each photo’s details.

The repository’s MIT license covers the original theme code. The following
material keeps its own license:

| Material | License | Included notice |
| --- | --- | --- |
| [Manrope](https://github.com/googlefonts/manrope) | SIL Open Font License 1.1 | [assets/manrope-OFL.txt](assets/manrope-OFL.txt) |
| [Caveat](https://github.com/googlefonts/caveat) | SIL Open Font License 1.1 | [assets/caveat-OFL.txt](assets/caveat-OFL.txt) |
| [exifr 7.1.3](https://github.com/MikeKovarik/exifr) | MIT | [assets/exifr-LICENSE.txt](assets/exifr-LICENSE.txt) |

Zero bundles the exifr npm package's lightweight browser parser with the JSX app.
Preact is provided by Spacefast Zero. Other npm packages retain their own licenses.

Photo files live in the connected WordPress media library and are not bundled in
this repository. Their rights remain with their owners. The tiny JPEG in
`tests/fixtures/exif-gps.jpg` is a generated EXIF test fixture.
