# JPEG XL

Tools: `pngfix` (`libpng-tools`), `cjxl` and `djxl` (`libjxl-tools`), `exiftool`
(`libimage-exiftool-perl`).

## pngfix

1. `cjxl` rejects a PNG with data after the `IEND` chunk ("Exuberant input after
   IEND chunk"), for example Samsung `PhotoEditor_Re_Edit_Data`. Run
   `pngfix --out=<fixed.png> <in.png>` first to remove it.
2. `pngfix` also fixes chunk CRC errors, zlib "too far back" errors, and wrong chunk
   lengths.
3. A `pngfix` exit code below 16 means that the output can be read, maybe with
   fixes.
4. A pipe works: `pngfix --out=/dev/stdout <in.png> | cjxl - <out.jxl>`.

## cjxl

1. `--distance=0` is lossless: the pixels are the same, but the bytes are not. An md5
   of the source does not match.
2. Use `--container=1`. `exiftool` can not write metadata to a bare JXL codestream.
3. `--compress_boxes=0` keeps the metadata boxes plain, so a text search finds the
   XMP.
4. `cjxl` copies EXIF from a PNG `eXIf` chunk into a Brotli EXIF box. That EXIF can
   be broken ("ExifIFD pointer references previous BrotliEXIF directory").
   `exiftool` marks this as a `[minor]` error, and it does not write a file that has
   an error, even a minor one: the write exits with code 1 and no XMP is saved. `-m`
   tells `exiftool` to ignore minor errors, so the XMP is written. The broken EXIF
   stays as it is. The other way is to delete the EXIF, but then you lose it.
5. `djxl <file.jxl> --disable_output` decodes a file without writing output.

## exiftool

1. `-json` gives values that look like numbers or booleans (`1.50`, `1e5`, `true`)
   as JSON numbers or booleans. Add `-api structformat=jsonq` to get strings.
2. `-json` gives a list with one item as a plain value, not as a list.
3. `-TAG+=` with an empty value fails with exit code 1.
4. `-overwrite_original_in_place` keeps the inode, so the file birth time does not
   change. `-overwrite_original` makes a new file.
5. `-quiet` two times hides warnings. Errors still print, and the exit code still
   shows a failure.
6. Test values that find these problems: `1`, `007`, `1.50`, `1e5`, `true`, `null`,
   and tags with `,`, `:`, or a leading `-`.

## XMP fields

1. `dc:subject` is the field that most tools show and search as tags.
2. `Iptc4xmpExt:PersonInImage` and `photoshop:SupplementalCategories` are plain text
   lists.
3. `Iptc4xmpExt:SeriesName` holds 1 series. `photoshop:Category` holds 1 short value.
4. `xmp:CreateDate` is when the digital file was made. `photoshop:DateCreated` (IPTC
   "Date Created") is when the artwork was made.
