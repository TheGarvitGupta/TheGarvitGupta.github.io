// Packer levels. Containers are convex polygons centred on the origin, in the
// same units as the pieces (every piece has side 1).
var PackerLevels = (function () {
  'use strict';

  var H = Math.sqrt(3) / 2;

  function box(side) {
    var h = side / 2;
    return [[-h, -h], [h, -h], [h, h], [-h, h]];
  }
  function ngon(n, radius, startDeg) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var r = (startDeg + i * 360 / n) * Math.PI / 180;
      out.push([radius * Math.cos(r), radius * Math.sin(r)]);
    }
    return out;
  }
  // A whisker of breathing room on the exact-fit shapes, so they forgive a shaky hand.
  function loosen(poly, k) {
    return poly.map(function (p) { return [p[0] * k, p[1] * k]; });
  }
  function pieces(squares, triangles) {
    var out = [], i;
    for (i = 0; i < squares; i++) out.push('square');
    for (i = 0; i < triangles; i++) out.push('triangle');
    return out;
  }

  var roofY = (Math.sqrt(3) - 2) / 2;   // where the house's walls meet its roof

  return [
    {
      name: 'Four Square',
      intro: 'Drag every shape into the box.',
      hint: 'No tricks here. Two on top, two below.',
      container: box(2.02),
      pieces: pieces(4, 0)
    },
    {
      name: 'Flip',
      intro: 'Shapes can spin. Pick one up, then drag its knob.',
      hint: 'Three triangles sit in the corners. The fourth goes upside-down in the middle.',
      container: loosen([[0, -4 * H / 3], [1, 2 * H / 3], [-1, 2 * H / 3]], 1.01),
      pieces: pieces(0, 4)
    },
    {
      name: 'Honeycomb',
      intro: 'Six slices, one hexagon.',
      hint: 'Point every triangle at the centre, like a pizza. They sit 60° apart.',
      container: loosen(ngon(6, 1, 0), 1.01),
      pieces: pieces(0, 6),
      scramble: true
    },
    {
      name: 'Home',
      intro: 'Squares and triangles, together at last.',
      hint: 'Squares build the walls, triangles build the roof.',
      container: loosen([[-1, roofY + 2], [1, roofY + 2], [1, roofY], [0, roofY - 2 * H], [-1, roofY]], 1.01),
      pieces: pieces(4, 4),
      scramble: true
    },
    {
      name: 'Tilt',
      intro: 'One triangle. One box. The box is narrower than the triangle.',
      hint: 'Lean it 15° and tuck one corner of the triangle into a corner of the box.',
      container: box(0.972),
      pieces: pieces(0, 1)
    },
    {
      name: 'Five Alive',
      intro: 'Five squares in a box too small for a tidy grid.',
      hint: 'One square in each corner. The fifth sits in the middle, turned 45°.',
      fact: 'The smallest box that holds five unit squares has side 2 + 1/√2 ≈ 2.707. This one is 2.713.',
      container: box(2.713),
      pieces: pieces(5, 0)
    },
    {
      name: 'Dozen',
      intro: 'Twelve sides, eighteen shapes, no gaps.',
      hint: 'Six triangles make a hexagon in the middle. Put a square on each of its sides, then a triangle in every gap. Everything sits on a multiple of 30°.',
      container: loosen(ngon(12, 1 / (2 * Math.sin(Math.PI / 12)), 15), 1.01),
      pieces: pieces(6, 12),
      scramble: true
    },
    {
      name: 'Ten Tight',
      intro: 'Ten squares. A 4×4 box would be easy, so this one is smaller.',
      hint: 'Three squares in one corner, three in the opposite corner, one in each of the other two. The last two turn 45° and run down the diagonal.',
      fact: 'Best possible is 3 + 1/√2 ≈ 3.707, found by Frits Göbel in 1979 and proved in 2003. This box is 3.713.',
      container: box(3.713),
      pieces: pieces(10, 0)
    },
    {
      name: 'Eleven',
      intro: 'One more square, and the neat patterns stop working.',
      hint: 'Six squares stay straight: one in each of two neighbouring corners, an L of three in a third corner, and one more further along that wall. The other five lean 40° in a clump.',
      fact: 'Walter Trump found this packing in 1979. The record box is 3.8771 across; this one is 3.885.',
      container: box(3.885),
      pieces: pieces(11, 0)
    },
    {
      name: 'Seventeen',
      intro: 'The famously ugly one. Seventeen squares, and no pattern will save you.',
      hint: 'Ten squares stay straight: an L of three in each bottom corner, one in each top corner, one on the top wall and one on a side wall. Six lean 40° in a 2\u00D73 block through the middle. The last one leans 37° the other way, tucked in near the top on that same side.',
      fact: 'John Bidwell found this packing in 1998. Nobody has beaten it, and nobody has proved it is the best. His box is 4.6755 across; this one is 4.68.',
      container: box(4.68),
      pieces: pieces(17, 0)
    }
  ];
})();
