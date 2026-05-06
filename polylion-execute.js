var tmax_opts = {
  delay: 0,
  repeat: 0,
  repeatDelay: 0,
  yoyo: false
};

var tmax_tl = new TimelineMax(tmax_opts),
  polylion_shapes = $('svg.polylion > g polygon'),
  polylion_stagger = 0.003,
  polylion_duration = 1;

var polylion_staggerFrom = {
  scale: 0,
  opacity: 0,
  transformOrigin: 'center center',
};

var polylion_staggerTo = {
  opacity: 1,
  scale: 1,
  ease: Elastic.easeInOut
};
//tmax_tl.staggerFromTo(polylion_shapes, polylion_duration, polylion_staggerFrom, polylion_staggerTo, polylion_stagger, 0);