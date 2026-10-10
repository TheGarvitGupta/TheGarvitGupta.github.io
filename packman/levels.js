// Packman levels. Containers are convex polygons centred on the origin, in the
// same units as the pieces (every piece has side 1). Each solution is one packed
// [x, y, angle] per piece, in the order the pieces are listed. The levels run
// from easiest to hardest; saved progress goes by name, so they can be reordered.
// There are four chapters, played in this order: the seventeen; then the powers; then the bricks and
// hexagons; then the twists, which are listed last here. In this file: the first is the seventeen; the next (bonus: true) brings
// the brick and the hexagon; the third (powers: n) deals n of its shapes a power each time,
// picked at random, but for any named in sure, which always come. A chameleon is dealt to
// any shape, unless chameleon: n names one; masked is the hint to give when there is a chameleon in the deal.
// Its first five levels are tidy tilings, to meet the powers on; from the sixth on they are tight packings. Each chapter is numbered on its own.
var PackmanLevels = (function () {
  'use strict';

  var H = Math.sqrt(3) / 2;

  function box(side) {
    var h = side / 2;
    return [[-h, -h], [h, -h], [h, h], [-h, h]];
  }
  function rect(w, h) {
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
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
      intro: 'The famously ugly one, and yes, it is hard. Pack it and a prize ships to you.',
      hint: 'Ten squares stay straight: an L of three in each bottom corner, one in each top corner, one on the top wall and one on a side wall. Six lean 40° in a 2\u00D73 block through the middle. The last one leans 37° the other way, tucked in near the top on that same side.',
      fact: 'John Bidwell found this packing in 1998. Nobody has beaten it, and nobody has proved it is the best. His box is 4.6755 across; this one is 4.68.',
      container: box(4.68),
      pieces: pieces(17, 0),
      solution: [[-1.84, 1.8406, 0], [-0.84, 1.84, 0], [-1.8405, 0.8412, 0], [1.84, 1.84, 0], [0.84, 1.84, 0], [1.84, 0.84, 0], [-1.8401, -1.8401, 0], [1.8406, -1.8405, 0], [0.0628, -1.84, 0], [1.84, -0.16, 0], [-0.9056, -1.0803, 40], [-1.6074, -0.3638, 40], [-0.0561, -0.5373, 40], [-0.6953, 0.2308, 40], [0.6356, 0.2005, 40], [-0.0026, 0.9704, 40], [0.9613, -1.0143, 323]]
    },
    {
      name: 'Brickwork',
      bonus: true,
      intro: 'No powers here. Four bricks, a square, and a box three across.',
      hint: 'The square goes dead centre. The four bricks chase each other round it, each one lying along a different wall.',
      container: box(3.006),
      pieces: pieces(1, 0, 4),
      solution: [[0, 0, 0], [-0.5, -1, 0], [1, -0.5, 90], [0.5, 1, 0], [-1, 0.5, 90]]
    },
    {
      name: 'Corners',
      bonus: true,
      intro: 'A hexagon and three triangles. The hexagon takes up most of the room.',
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
    },
    {
      name: 'Warm Up',
      powers: 1,
      intro: 'A new shape, the brick, two squares long. And some shapes have powers now: pick one up to see.',
      hint: 'The brick lies along one wall. The two squares sit side by side along the other.',
      container: box(2.004),
      pieces: pieces(2, 0, 1),
      solution: [[-0.5, 0.5, 0], [0.5, 0.5, 0], [0, -0.5, 0]]
    },
    {
      name: 'Boat',
      powers: 1,
      intro: 'Five triangles in a hull.',
      hint: 'Three stand on the floor. The other two hang upside-down between them.',
      container: loosen([[-1.5, H / 2], [1.5, H / 2], [1, -H / 2], [-1, -H / 2]], 1.004),
      pieces: pieces(0, 5),
      solution: [[-1, 0.1443, 0], [0, 0.1443, 0], [1, 0.1443, 0], [-0.5, -0.1443, 180], [0.5, -0.1443, 180]]
    },
    {
      name: 'Shelf',
      powers: 1,
      intro: 'Two bricks, two squares, two rows.',
      hint: 'Each row is one brick and one square. Put the squares at opposite ends.',
      container: loosen(rect(3, 2), 1.002),
      pieces: pieces(2, 0, 2),
      solution: [[1, -0.5, 0], [-1, 0.5, 0], [-0.5, -0.5, 0], [0.5, 0.5, 0]]
    },
    {
      name: 'Slant',
      powers: 1,
      intro: 'A leaning box, two triangles, and another new shape: the hexagon.',
      hint: 'The hexagon goes in the middle and touches all four walls. A triangle fills each sharp corner.',
      container: loosen([[-1.5, -H], [0.5, -H], [1.5, H], [-0.5, H]], 1.004),
      pieces: pieces(0, 2, 0, 1),
      solution: [[-1, -0.5774, 180], [1, 0.5774, 0], [0, 0, 0]]
    },
    {
      name: 'Barge',
      powers: 2,
      intro: 'Two powers at once from here.',
      hint: 'Push the hexagon into the top-left corner, flat against the ceiling and the floor. Two triangles fit beside it at the top, four along the floor.',
      container: loosen([[-1, -H], [1, -H], [2, H], [-2, H]], 1.004),
      pieces: pieces(0, 6, 0, 1),
      scramble: true,
      solution: [[0.5, -0.5774, 180], [1, -0.2887, 0], [-1.5, 0.5774, 0], [0.5, 0.5774, 0], [1, 0.2887, 180], [1.5, 0.5774, 0], [-0.5, 0, 0]]
    },
    {
      name: 'Windmill',
      powers: 1,
      sure: ['sleeper'],
      intro: 'No more neat grids. Four triangles, and a box that looks one too small.',
      hint: 'A pinwheel. Each triangle lies with one side flat against a different wall, pushed along to one end of it, all four going the same way round.',
      container: box(1.584),
      pieces: pieces(0, 4),
      solution: [[0.2876, 0.5003, 0], [-0.2876, -0.5003, 60], [0.5003, -0.2876, 30], [-0.5003, 0.2876, 90]]
    },
    {
      name: 'Odd Squad',
      powers: 2,
      intro: 'A square and three triangles, in a box with no room to line them up.',
      hint: 'The square goes snug in a corner. One triangle hangs upside-down beneath it. One lies with a side flat against the wall beside the square, at 30°. The last goes in the far corner, turned to 105°.',
      container: box(1.872),
      pieces: pieces(1, 3),
      solution: [[-0.4331, -0.4331, 0], [-0.4147, 0.3557, 60], [0.3754, 0.4147, 105], [0.6442, -0.4147, 30]]
    },
    {
      name: 'Corner Brick',
      powers: 2,
      sure: ['chameleon'],
      chameleon: 3,   // the brick
      masked: 'Give each square a corner of its own. The chameleon gets whatever room is left, and it will not go in straight.',
      intro: 'Three squares and a brick. The box is well short of three across.',
      hint: 'A square goes snug in each of three corners. The brick turns 45° and lies along the diagonal, with its end pushed into the empty corner.',
      container: box(2.775),
      pieces: pieces(3, 0, 1),
      solution: [[0.8526, 0.8526, 0], [0.8844, -0.8844, 0], [-0.8844, -0.8844, 0], [-0.3237, 0.3218, 135]]
    },
    {
      name: 'Rough Diamond',
      powers: 2,
      intro: 'Three squares, two triangles, and not much more room than the squares need.',
      hint: 'The three squares make an L round one corner. The two triangles share the opposite corner, joined edge to edge as a diamond laid across the diagonal: one at 15°, the other at 75°.',
      container: box(2.185),
      pieces: pieces(3, 2),
      solution: [[-0.4104, -0.5896, 0], [0.5896, -0.5896, 0], [0.5846, 0.4104, 0], [-0.6814, 0.2706, 75], [-0.2757, 0.6814, 15]]
    },
    {
      name: 'Crossbar',
      powers: 2,
      intro: 'Two bricks and a square. Laid straight they need a box three across; this one is not.',
      hint: 'One brick stands upright against a side wall, pushed into the top corner. The square sits against the top wall beside it. The second brick turns 45° and lies across the corner that is left.',
      container: box(2.921),
      pieces: pieces(1, 0, 2),
      solution: [[0.0426, -0.9574, 0], [0.3968, 0.3968, 135], [-0.9574, -0.4561, 90]]
    },
    {
      name: 'Hex Mix',
      powers: 3,
      intro: 'Two squares and two triangles in a honeycomb cell. Three powers at once from here.',
      hint: 'One square turns 45° and pokes a corner into a corner of the hexagon. The other lies flat against a wall on the far side, at 60°. One triangle lies flat against a wall next to the first square, and the other fills the gap that is left, at 105°.',
      container: ngon(6, 1.291, 0),
      pieces: pieces(2, 2),
      solution: [[0.5664, -0.0196, 45], [-0.4642, 0.4213, 60], [0.0865, -0.824, 60], [-0.528, -0.4944, 105]]
    },
    {
      name: 'Mixed Bag',
      powers: 3,
      intro: 'One of each: a hexagon, a square and a triangle.',
      hint: 'Turn the hexagon 15° and push it into a corner. The square goes snug in the opposite corner. The triangle squeezes into a third corner at 90°, one side upright against the wall.',
      container: box(2.587),
      pieces: pieces(1, 1, 0, 1),
      solution: [[0.7903, 0.7863, 0], [-0.9024, 0.7903, 90], [-0.3238, -0.3244, 15]]
    },
    {
      name: 'Channel',
      powers: 3,
      intro: 'Two bricks and two triangles, in a box too narrow to lay anything flat.',
      hint: 'Stand a brick upright against each side wall: one pushed up into its top corner, the other down into its bottom corner. The triangles go in the channel between them, one at the top at 45° and one at the bottom at 105°.',
      container: box(2.619),
      pieces: pieces(0, 2, 2),
      solution: [[0.1028, 0.8982, 105], [-0.1018, -0.8982, 45], [0.8065, -0.3064, 90], [-0.8065, 0.3054, 90]]
    },
    {
      name: 'Five Points',
      powers: 3,
      intro: 'Five triangles, and none of them sits square.',
      hint: 'One hangs flat from the middle of the top wall. The other four each have a side standing upright, so they point left or right: one against each side wall, half way up, and two more below them on the floor.',
      container: box(1.812),
      pieces: pieces(0, 5),
      solution: [[0.6141, -0.1037, 30], [0.3254, 0.4028, 90], [-0.3254, 0.4028, 30], [-0.6141, -0.0972, 90], [-0.0019, -0.6141, 60]]
    },
    {
      name: 'Tight Bricks',
      powers: 3,
      sure: ['sticky', 'magnet', 'chameleon'],
      chameleon: 6,   // which shape is the chameleon here: the brick along the top wall
      // the hint with a chameleon about: it says where the chameleon goes, and never what shape it really is
      masked: 'The chameleon sits at the top left, against the top wall, with a square under it. A brick lies along the bottom wall from the right corner, with a square on top of its end. A square goes in each of the other two corners, and the last two squares turn 45° and run down the diagonal.',
      intro: 'Ten Tight again, with some of its squares welded into bricks. And powers.',
      hint: 'A brick lies along the top wall from the left corner, with a square under its end. The other brick lies along the bottom wall from the right corner, with a square on top of its end. A square goes in each of the other two corners, and the last two turn 45° and run down the diagonal.',
      container: box(3.713),
      pieces: pieces(6, 0, 2),
      solution: [[-1.3565, -0.3565, 0], [1.3565, 0.3565, 0], [1.3565, -1.3565, 0], [-1.3565, 1.3565, 0], [-0.2071, 0.2012, 45], [0.5, -0.5059, 45], [-0.8565, -1.3565, 0], [0.8565, 1.3565, 0]]
    },
    // The fourth chapter (twist: true): tight packings, each with one idea of its own, and powers on some of them.
    // pin gives a power to one shape by number. A level may have two boxes (containers); sets of entangled shapes
    // that turn together (twins) or against each other (gears); and a line no entangled shape may cross (divide).
    {
      name: 'Haojun\u2019s Gears',
      twist: true,
      gears: [[0, 1], [2, 3]],   // geared pairs: one turns against the other
      intro: 'Windmill again, in pairs. Shapes that look alike are geared: turn one, and the other turns the opposite way.',
      hint: 'A pinwheel. Each triangle lies with one side flat against a different wall, pushed along to one end of it, all four going the same way round. The two of a pair go against opposite walls, top and bottom or left and right: get one flat against its wall and the other is right too.',
      container: box(1.584),
      pieces: pieces(0, 4),
      solution: [[0.2876, 0.5003, 0], [-0.2876, -0.5003, 60], [0.5003, -0.2876, 30], [-0.5003, 0.2876, 90]]
    },
    {
      name: 'Split Decision',
      twist: true,
      intro: 'Two boxes, two squares, five triangles. Work out which shapes go in which box.',
      hint: 'The smaller box takes a square and two triangles: the square against the middle of the right-hand wall, one triangle flat on the floor and one hanging flat from the ceiling, their points meeting beside it. The bigger box takes the rest: the square snug in the top-left corner, a triangle hanging upside-down beneath it, one flat against the right-hand wall at 30°, and the last in the bottom corner at 105°.',
      containers: [box(1.783).map(function (p) { return [p[0] - 1.086, p[1]]; }), box(1.872).map(function (p) { return [p[0] + 1.0415, p[1]]; })],
      container: box(1.783).map(function (p) { return [p[0] - 1.086, p[1]]; }).concat(box(1.872).map(function (p) { return [p[0] + 1.0415, p[1]]; })),
      pieces: pieces(2, 5),
      solution: [[-0.698, 0, 0], [0.6084, -0.4331, 0], [-1.474, 0.599, 0], [-1.474, -0.599, 180], [0.6268, 0.3557, 60], [1.4169, 0.4147, 105], [1.6857, -0.4147, 30]]
    },
    {
      name: 'Minefield',   // (it was Short Fuse, with one mine: game.js carries a win of that over)
      twist: true,
      powers: 6,
      sure: ['mine', 'mine', 'mine', 'mine', 'mine', 'mine'],
      pin: { mine: [0, 1, 2, 3, 4, 5] },   // every shape
      intro: 'Two bricks and four triangles. Every one is a mine, and the bricks will not go in straight.',
      hint: 'Lay the two bricks side by side as one big square, both turned to 120°, so the big square stands on a corner and touches all four walls. A triangle fills each of the four gaps it leaves against the walls. Every shape is a mine: turn each in short goes, outside the box, and its fuse never runs out.',
      container: box(2.74),
      pieces: pieces(0, 4, 2),
      solution: [[0.866, 1.0774, 240], [1.0774, -0.866, 150], [-0.866, -1.0773, 180], [-1.0774, 0.866, 330], [0.433, 0.25, 300], [-0.433, -0.25, 120]]
    },
    {
      name: 'Sleepwalker',
      twist: true,
      powers: 1,
      sure: ['sleeper'],
      pin: { sleeper: 8 },   // the brick
      intro: 'Ten Tight once more, with one brick. The brick is a sleeper, and it will not lie straight.',
      hint: 'Turn the brick to 45° outside the box, then carry it in and lay it corner to corner through the middle. Three squares make an L in one corner beside it, three in the opposite corner, and one goes in each of the other two.',
      container: box(3.713),
      pieces: pieces(8, 0, 1),
      solution: [[-1.3565, -1.3565, 0], [-0.3565, -1.3565, 0], [-1.3565, -0.3565, 0], [1.3565, 1.3565, 0], [0.3565, 1.3565, 0], [1.3565, 0.3565, 0], [1.3565, -1.3565, 0], [-1.3565, 1.3565, 0], [0.1464, -0.1523, 135]]
    },
    {
      name: 'Keystone',
      twist: true,
      powers: 2,
      sure: ['puffer'],
      pin: { puffer: 6 },   // the hexagon
      intro: 'Seven shapes, and the hexagon is a puffer: it goes in first, with nothing to line it up against.',
      hint: 'The hexagon goes in before anything else: turned 15° off straight and pushed into the top-right corner. Two squares stack down the left wall from the top corner, and the third goes in the bottom-right corner. The three triangles fill the bottom-left: one flat on the floor, one above it against the left wall at 60°, and one leaning at 45° between them and the hexagon.',
      container: box(2.944),
      pieces: pieces(3, 3, 0, 1),
      solution: [[0.9677, 0.9681, 0], [-0.9666, 0.0334, 0], [-0.9659, -0.9666, 0], [-0.9685, 0.8281, 300], [0.08, 0.7987, 45], [-0.5048, 1.1798, 120], [0.5025, -0.5025, 15]]
    },
    {
      name: 'Double Bluff',
      twist: true,
      powers: 2,
      sure: ['chameleon', 'magnet'],
      chameleon: 1,   // the triangle on the floor
      masked: 'The chameleon sits on the floor in the bottom-left corner. The brick stands upright against the left wall above it, in the top corner, with the square beside it against the ceiling. The hexagon turns 15° off straight and goes into the bottom-right corner, and a triangle lies in the top-right corner, pointing left.',
      intro: 'One of each, and one more. Counting the shapes will not tell you which.',
      hint: 'The brick stands upright against the left wall, in the top corner, with the square beside it against the ceiling. Turn the hexagon 15° off straight and push it into the bottom-right corner. One triangle lies in the top-right corner, pointing left; the other sits on the floor in the bottom-left.',
      container: box(2.892),
      pieces: pieces(1, 2, 1, 1),
      solution: [[0.0578, -0.9422, 90], [-0.5867, 1.1457, 240], [1.1353, -0.8924, 270], [-0.9422, -0.4422, 90], [0.4763, 0.4763, 105]]
    },
    {
      name: 'Eleven Bricks',
      twist: true,
      powers: 3,
      sure: ['magnet', 'chameleon'],
      chameleon: 7,   // the brick standing against the side wall
      masked: 'The chameleon stands upright against the left wall, in the bottom corner. A brick lies along the floor beside it. A square goes in each top corner, and the other five squares lean 40° in a clump.',
      intro: 'Eleven again, with four of its squares welded into two bricks. And powers.',
      hint: 'One brick stands upright against the left wall, in the bottom corner. The other lies along the floor beside it. A square goes in each top corner, and the other five squares lean 40° in a clump.',
      container: box(3.885),
      pieces: pieces(7, 0, 2),
      solution: [[-1.4431, -1.443, 0], [1.4431, -1.4432, 0], [-0.675, -0.4857, 40], [0.0212, 0.2403, 40], [1.2381, 0.4424, 40], [0.7116, -0.4858, 40], [0.0154, -1.2118, 40], [-1.4425, 0.9425, 90], [0.0575, 1.443, 0]]
    },
    {
      name: 'Duality',
      twist: true,
      powers: 1,
      twins: [[4, 5], [0, 6], [1, 7]],   // entangled pairs: each turns when the other does
      pool: ['mine', 'sticky', 'sleeper', 'magnet', 'puffer'],   // no chameleon: its line would take the place of the one that explains the level
      divide: -0.0155,   // a line half way between the boxes: an entangled shape keeps to the side its spot is on
      intro: 'Two boxes. Shapes that look alike are entangled: turn one and its twin turns too. Neither can cross the line.',
      hint: 'The square box is Five Alive: four squares in the corners and one in the middle at 45°. The honeycomb is Pinwheel: three squares flat against every other wall, at 0°, 30° and 60°. Each pair of twins is split by the line, one in each box. The twin of the square in the middle sits straight in the honeycomb; the twins of the two that lean there sit straight in corners of the square box.',
      containers: [box(2.713).map(function (p) { return [p[0] - 1.522, p[1]]; }), ngon(6, 1.372, 0).map(function (p) { return [p[0] + 1.5065, p[1]]; })],
      container: box(2.713).map(function (p) { return [p[0] - 1.522, p[1]]; }).concat(ngon(6, 1.372, 0).map(function (p) { return [p[0] + 1.5065, p[1]]; })),   // every corner of both, for the board's bounds
      pieces: pieces(8, 0),
      solution: [[-2.3785, -0.8565, 0], [-0.6655, -0.8565, 0], [-2.3785, 0.8565, 0], [-0.6655, 0.8565, 0], [-1.522, 0, 45], [1.317, 0.6822, 0], [1.0035, -0.5052, 30], [2.186, -0.1872, 60]]
    },
    {
      name: 'Trinity',
      twist: true,
      twins: [[2, 3, 1], [0, 5, 4]],   // entangled threes: all turn when one does
      // (the honeycomb is tucked in under the triangle's slope, nearer than the two would stand side by side)
      intro: 'Tripod and Pinwheel, side by side. The squares are entangled in threes: turn one and the other two turn with it.',
      hint: 'Each box takes three squares flat against three walls, at 0°, 30° and 60°. In each set of three, two squares match and the third is 30° off. Put the matching two in different boxes. One set gives both boxes their straight square and the triangle its 30°; the other gives both their 60° and the honeycomb its 30°.',
      containers: [loosen([[0, -2 * H / 3], [0.5, H / 3], [-0.5, H / 3]], 3.245).map(function (p) { return [p[0] - 1.147, p[1] + 0.468]; }), ngon(6, 1.372, 0).map(function (p) { return [p[0] + 1.3975, p[1]]; })],
      container: loosen([[0, -2 * H / 3], [0.5, H / 3], [-0.5, H / 3]], 3.245).map(function (p) { return [p[0] - 1.147, p[1] + 0.468]; }).concat(ngon(6, 1.372, 0).map(function (p) { return [p[0] + 1.3975, p[1]]; })),
      pieces: pieces(6, 0),
      solution: [[-0.4988, 0.7173, 60], [-1.2527, -0.2225, 30], [-1.6857, 0.8935, 0], [1.208, 0.6822, 0], [0.8945, -0.5052, 30], [2.077, -0.1872, 60]]
    }
  ];
})();
