// Packman levels. Containers are convex polygons centred on the origin, in the
// same units as the pieces (every piece has side 1). Each solution is one packed
// [x, y, angle] per piece, in the order the pieces are listed. The levels run
// from easiest to hardest; saved progress goes by name, so they can be reordered.
// Bonus levels come last, after the seventeen, and are numbered on their own.
var PackmanLevels = (function () {
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
  // A whisker of breathing room on the exact-fit shapes: less than a pixel, so
  // pieces packed edge to edge still look evenly spaced.
  function loosen(poly, k) {
    return poly.map(function (p) { return [p[0] * k, p[1] * k]; });
  }
  function pieces(squares, triangles, dominoes, hexagons) {
    var out = [], i;
    for (i = 0; i < squares; i++) out.push('square');
    for (i = 0; i < triangles; i++) out.push('triangle');
    for (i = 0; i < (dominoes || 0); i++) out.push('domino');
    for (i = 0; i < (hexagons || 0); i++) out.push('hexagon');
    return out;
  }

  var roofY = (Math.sqrt(3) - 2) / 2;   // where the house's walls meet its roof

  return [
    {
      name: 'Four Square',
      intro: 'Drag every shape into the box.',
      hint: 'No tricks here. Two on top, two below.',
      container: box(2.004),
      pieces: pieces(4, 0),
      solution: [[-0.5, -0.5, 0], [0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0]]
    },
    {
      name: 'Flip',
      intro: 'Shapes can spin. Pick one up, then drag its knob.',
      hint: 'Three triangles sit in the corners. The fourth goes upside-down in the middle.',
      container: loosen([[0, -4 * H / 3], [1, 2 * H / 3], [-1, 2 * H / 3]], 1.002),
      pieces: pieces(0, 4),
      solution: [[0, -0.5774, 0], [-0.5, 0.2887, 0], [0.5, 0.2887, 0], [0, 0, 180]]
    },
    {
      name: 'Honeycomb',
      intro: 'Six slices, one hexagon.',
      hint: 'Point every triangle at the centre, like a pizza. They sit 60° apart.',
      container: loosen(ngon(6, 1, 0), 1.002),
      pieces: pieces(0, 6),
      scramble: true,
      solution: [[0.5, 0.2887, 300], [0, 0.5774, 0], [-0.5, 0.2887, 60], [-0.5, -0.2887, 120], [0, -0.5774, 180], [0.5, -0.2887, 240]]
    },
    {
      name: 'Home',
      intro: 'Squares and triangles, together at last.',
      hint: 'Squares build the walls, triangles build the roof.',
      container: loosen([[-1, roofY + 2], [1, roofY + 2], [1, roofY], [0, roofY - 2 * H], [-1, roofY]], 1.004),
      pieces: pieces(4, 4),
      scramble: true,
      solution: [[-0.5, 0.366, 0], [0.5, 0.366, 0], [-0.5, 1.366, 0], [0.5, 1.366, 0], [0, -1.2887, 0], [-0.5, -0.4226, 0], [0.5, -0.4226, 0], [0, -0.7113, 180]]
    },
    {
      name: 'Lantern',
      intro: 'A honeycomb, stretched, with two squares across the middle.',
      hint: 'Two squares side by side across the middle. Three triangles above them and three below: point, flip, point.',
      container: loosen([[-1, -0.5], [-0.5, -0.5 - H], [0.5, -0.5 - H], [1, -0.5], [1, 0.5], [0.5, 0.5 + H], [-0.5, 0.5 + H], [-1, 0.5]], 1.004),
      pieces: pieces(2, 6),
      scramble: true,
      solution: [[-0.5, 0, 0], [0.5, 0, 0], [-0.5, -0.7887, 0], [0.5, -0.7887, 0], [0, -1.0774, 180], [-0.5, 0.7887, 180], [0.5, 0.7887, 180], [0, 1.0774, 0]]
    },
    {
      name: 'Tilt',
      intro: 'One triangle. One box. The box is narrower than the triangle.',
      hint: 'Lean it 15° and tuck one corner of the triangle into a corner of the box.',
      container: box(0.972),
      pieces: pieces(0, 1),
      solution: [[0.0717, 0.0717, 15]]
    },
    {
      name: 'Squeeze',
      intro: 'Three shapes. Side by side they would need a bigger box.',
      hint: 'Nothing leans. The square sits against the middle of one wall. One triangle rests flat on the floor, the other hangs flat from the ceiling, and their points meet beside the square.',
      container: box(1.783),
      pieces: pieces(1, 2),
      solution: [[0.388, 0, 0], [-0.388, 0.599, 0], [-0.388, -0.599, 180]]
    },
    {
      name: 'Five Alive',
      intro: 'Five squares in a box too small for a tidy grid.',
      hint: 'One square in each corner. The fifth sits in the middle, turned 45°.',
      fact: 'The smallest box that holds five unit squares has side 2 + 1/√2 ≈ 2.707. This one is 2.713.',
      container: box(2.713),
      pieces: pieces(5, 0),
      solution: [[-0.8565, -0.8565, 0], [0.8565, -0.8565, 0], [-0.8565, 0.8565, 0], [0.8565, 0.8565, 0], [0, 0, 45]]
    },
    {
      name: 'Dozen',
      intro: 'Twelve sides, eighteen shapes, no gaps.',
      hint: 'Six triangles make a hexagon in the middle. Put a square on each of its sides, then a triangle in every gap. Everything sits on a multiple of 30°.',
      container: loosen(ngon(12, 1 / (2 * Math.sin(Math.PI / 12)), 15), 1.004),
      pieces: pieces(6, 12),
      scramble: true,
      solution: [[1.183, 0.683, 30], [0, 1.366, 0], [-1.183, 0.683, 60], [-1.183, -0.683, 30], [0, -1.366, 0], [1.183, -0.683, 60], [0.5, 0.2887, 300], [0, 0.5774, 0], [-0.5, 0.2887, 60], [-0.5, -0.2887, 120], [0, -0.5774, 180], [0.5, -0.2887, 240], [1.5774, 0, 270], [0.7887, 1.366, 330], [-0.7887, 1.366, 30], [-1.5774, 0, 90], [-0.7887, -1.366, 150], [0.7887, -1.366, 210]]
    },
    {
      name: 'Diamond',
      intro: 'Two triangles, and a box that looks too small for them.',
      hint: 'Join them edge to edge to make a diamond. Then lay the diamond corner to corner across the box: one triangle at 15°, the other at 75°.',
      fact: 'The diamond is \u221A3 long, so it only fits along the diagonal. The smallest box is \u221A6/2 \u2248 1.225 across; this one is 1.232.',
      container: box(1.232),
      pieces: pieces(0, 2),
      solution: [[0.204, 0.204, 15], [-0.204, -0.204, 75]]
    },
    {
      name: 'Odd Couple',
      intro: 'One square, one triangle. Stacked up they would poke out of the top.',
      hint: 'The square goes snug in a corner. The triangle goes in the opposite corner, turned to 75°, so one of its edges slants across the square\u2019s free corner.',
      container: box(1.619),
      pieces: pieces(1, 1),
      solution: [[0.3095, 0.3095, 0], [-0.4013, -0.388, 75]]
    },
    {
      name: 'Tripod',
      intro: 'A triangle with barely room for two squares side by side. Fit three.',
      hint: 'Give each square its own wall. One sits flat on the floor, and the other two lie flat against the sloping sides, at 30° and 60°.',
      container: loosen([[0, -2 * H / 3], [0.5, H / 3], [-0.5, H / 3]], 3.245),
      pieces: pieces(3, 0),
      solution: [[0.6482, 0.2493, 60], [-0.1057, -0.6905, 30], [-0.5387, 0.4255, 0]]
    },
    {
      name: 'Pinwheel',
      intro: 'Three squares in a honeycomb cell. A neat row will not fit.',
      hint: 'Each square lies flat against a wall, with an empty wall between each pair. They sit at 0°, 30° and 60°, like the blades of a pinwheel.',
      container: ngon(6, 1.372, 0),
      pieces: pieces(3, 0),
      solution: [[-0.1895, 0.6822, 0], [-0.503, -0.5052, 30], [0.6795, -0.1872, 60]]
    },
    {
      name: 'Trio',
      intro: 'Three triangles, and a box that only looks big enough for two.',
      hint: 'One triangle hangs flat from the ceiling, at 60°. One stands flat against the right-hand wall, at 30°. The third tucks into the bottom-left corner at 105°.',
      container: box(1.488),
      pieces: pieces(0, 3),
      solution: [[-0.1412, -0.4553, 60], [0.4361, 0.122, 30], [-0.3358, 0.3358, 105]]
    },
    {
      name: 'Ten Tight',
      intro: 'Ten squares. A 4×4 box would be easy, so this one is smaller.',
      hint: 'Three squares in one corner, three in the opposite corner, one in each of the other two. The last two turn 45° and run down the diagonal.',
      fact: 'Best possible is 3 + 1/√2 ≈ 3.707, found by Frits Göbel in 1979 and proved in 2003. This box is 3.713.',
      container: box(3.713),
      pieces: pieces(10, 0),
      solution: [[-1.3565, -1.3565, 0], [-0.3565, -1.3565, 0], [-1.3565, -0.3565, 0], [1.3565, 1.3565, 0], [0.3565, 1.3565, 0], [1.3565, 0.3565, 0], [1.3565, -1.3565, 0], [-1.3565, 1.3565, 0], [-0.2071, 0.2012, 45], [0.5, -0.5059, 45]]
    },
    {
      name: 'Eleven',
      intro: 'One more square, and the neat patterns stop working.',
      hint: 'Six squares stay straight: one in each of two neighbouring corners, an L of three in a third corner, and one more further along that wall. The other five lean 40° in a clump.',
      fact: 'Walter Trump found this packing in 1979. The record box is 3.8771 across; this one is 3.885.',
      container: box(3.885),
      pieces: pieces(11, 0),
      solution: [[-1.4431, -1.443, 0], [1.4431, -1.4432, 0], [-1.4425, 1.4425, 0], [-0.4425, 1.4425, 0], [-1.4425, 0.4425, 0], [0.5575, 1.4436, 0], [-0.675, -0.4857, 40], [0.0212, 0.2403, 40], [1.2381, 0.4424, 40], [0.7116, -0.4858, 40], [0.0154, -1.2118, 40]]
    },
    {
      name: 'Seventeen',
      intro: 'The famously ugly one, and yes, it is hard. Pack it and a prize is yours.',
      hint: 'Ten squares stay straight: an L of three in each bottom corner, one in each top corner, one on the top wall and one on a side wall. Six lean 40° in a 2\u00D73 block through the middle. The last one leans 37° the other way, tucked in near the top on that same side.',
      fact: 'John Bidwell found this packing in 1998. Nobody has beaten it, and nobody has proved it is the best. His box is 4.6755 across; this one is 4.68.',
      container: box(4.68),
      pieces: pieces(17, 0),
      solution: [[-1.84, 1.8406, 0], [-0.84, 1.84, 0], [-1.8405, 0.8412, 0], [1.84, 1.84, 0], [0.84, 1.84, 0], [1.84, 0.84, 0], [-1.8401, -1.8401, 0], [1.8406, -1.8405, 0], [0.0628, -1.84, 0], [1.84, -0.16, 0], [-0.9056, -1.0803, 40], [-1.6074, -0.3638, 40], [-0.0561, -0.5373, 40], [-0.6953, 0.2308, 40], [0.6356, 0.2005, 40], [-0.0026, 0.9704, 40], [0.9613, -1.0143, 323]]
    },
    {
      name: 'Brickwork',
      bonus: true,
      intro: 'A new shape: the brick, two squares long.',
      hint: 'The square goes dead centre. The four bricks chase each other round it, each one lying along a different wall.',
      container: box(3.006),
      pieces: pieces(1, 0, 4),
      solution: [[0, 0, 0], [-0.5, -1, 0], [1, -0.5, 90], [0.5, 1, 0], [-1, 0.5, 90]]
    },
    {
      name: 'Corners',
      bonus: true,
      intro: 'Another new shape: the hexagon. It takes up most of the room.',
      hint: 'The hexagon sits in the middle with three of its sides against the walls. A triangle fills each corner.',
      container: loosen([[0, -2 * H / 3], [0.5, H / 3], [-0.5, H / 3]], 3.012),
      pieces: pieces(0, 3, 0, 1),
      solution: [[0, -1.1547, 0], [-1, 0.5774, 0], [1, 0.5774, 0], [0, 0, 0]]
    },
    {
      name: 'Wedged',
      bonus: true,
      intro: 'One hexagon. It is two across, and the box is not.',
      hint: 'Turn it 15°. Two of its corners touch the side walls and two touch the floor and ceiling.',
      fact: 'The smallest square that holds a hexagon of side 1 is 2 cos 15° \u2248 1.932 across. This one is 1.94.',
      container: box(1.94),
      pieces: pieces(0, 0, 0, 1),
      solution: [[0, 0, 15]]
    },
    {
      name: 'Snug',
      bonus: true,
      intro: 'A hexagon and two triangles, in a box that fits them like a glove.',
      hint: 'Stand the hexagon on a point, at 30°, against the right-hand wall. Its sloping sides leave a notch at the top and the bottom on the left. One triangle goes in the bottom corner at 90°, pointing at the hexagon, and the other in the top corner at 75°.',
      container: box(2.321),
      pieces: pieces(0, 2, 0, 1),
      solution: [[-0.8281, 0.6605, 90], [-0.7523, -0.7523, 75], [0.2945, -0.0247, 30]]
    },
    {
      name: 'Trefoil',
      bonus: true,
      intro: 'A tiling: three hexagons and six triangles fill this hexagon with nothing left over.',
      hint: 'No hexagon goes in the middle. All three meet at the centre point, like a three-leaf clover, each one reaching out to a wall. That leaves three empty corners, and each takes a pair of triangles.',
      fact: 'A hexagon of side 2 is exactly 24 small triangles. Three hexagons use 18 of them, and the six loose triangles are the rest.',
      container: loosen(ngon(6, 2, 0), 1.004),
      pieces: pieces(0, 6, 0, 3),
      solution: [[-1.5, 0.2887, 180], [-1.5, -0.2887, 0], [0.5, 1.4434, 0], [1, 1.1547, 180], [0.5, -1.4434, 180], [1, -1.1547, 0], [1, 0, 0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]]
    },
    {
      name: 'Bricked In',
      bonus: true,
      intro: 'Two bricks, and a hexagon that looks a size too small.',
      hint: 'Lay the bricks side by side to make a block, then turn the whole block to 15°. Its four corners each find a different wall.',
      container: ngon(6, 1.547, 0),
      pieces: pieces(0, 0, 2),
      solution: [[-0.02, 0.5235, 15], [0.0088, -0.5041, 15]]
    },
    {
      name: 'Twin Hex',
      bonus: true,
      intro: 'Two hexagons. Side by side they are four across; stacked they are too tall.',
      hint: 'Turn both to 15°. Put one in the top-left corner and the other in the bottom-right, so they meet along a slanted edge in the middle.',
      container: box(3.17),
      pieces: pieces(0, 0, 0, 2),
      solution: [[-0.6191, -0.6191, 15], [0.6191, 0.5923, 15]]
    },
    {
      name: 'Off Centre',
      bonus: true,
      intro: 'A hexagon inside a hexagon, with two triangles to squeeze in beside it.',
      hint: 'Keep the hexagon straight but push it into the top-left, off centre. That opens a crescent of room on the other side: one triangle goes on the right at 105°, the other at the bottom at 15°.',
      container: ngon(6, 1.487, 0),
      pieces: pieces(0, 2, 0, 1),
      solution: [[0.9293, -0.1494, 105], [0.3702, 0.8113, 15], [-0.3425, -0.2502, 0]]
    },
    {
      name: 'Rosette',
      bonus: true,
      intro: 'The big tiling: one hexagon, six squares and six triangles make a perfect twelve-sided ring.',
      hint: 'The hexagon goes dead centre. A square sits flat against each of its six sides. The six gaps between the squares are each exactly one triangle, point inwards.',
      fact: 'This is one patch of a pattern that can tile a whole floor: every corner is where a triangle, two squares and a hexagon meet.',
      container: loosen(ngon(12, 1.9318517, 15), 1.004),
      pieces: pieces(6, 6, 0, 1),
      solution: [[1.183, 0.683, 30], [0, 1.366, 0], [-1.183, 0.683, 60], [-1.183, -0.683, 30], [0, -1.366, 0], [1.183, -0.683, 60], [1.5774, 0, 30], [0.7887, 1.366, 90], [-0.7887, 1.366, 30], [-1.5774, 0, 90], [-0.7887, -1.366, 30], [0.7887, -1.366, 90], [0, 0, 0]]
    }
  ];
})();
