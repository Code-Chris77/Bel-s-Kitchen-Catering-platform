"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const heroSlides = [
  {
    image: "/hero-slide-fried.webp",
    eyebrow: "GOLDEN WOK FLAVOUR",
    title: "Fried rice, fired fresh.",
    description: "Smoky rice, bright vegetables and juicy grilled chicken—served hot from the kitchen.",
  },
  {
    image: "/hero-slide-jollof.webp",
    eyebrow: "SLOW-COOKED GHANA FLAVOUR",
    title: "Jollof worth gathering for.",
    description: "Rich tomato spice, fragrant grains and grilled chicken with that proper party-jollof finish.",
  },
  {
    image: "/hero-slide-mix.webp",
    eyebrow: "TWO FAVOURITES, ONE BOWL",
    title: "Why choose just one?",
    description: "Fried rice and jollof together with grilled chicken, made for the days you want everything.",
  },
];

/** Auto-advancing featured-meals slideshow; pauses on hover/focus, on request, and for reduced motion. */
export function HeroCarousel() {
  const [heroApi, setHeroApi] = useState<CarouselApi>();
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [heroHovered, setHeroHovered] = useState(false);

  useEffect(() => {
    if (!heroApi) return;

    const selectSlide = () => setActiveHeroSlide(heroApi.selectedScrollSnap());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    selectSlide();
    heroApi.on("select", selectSlide);
    heroApi.on("reInit", selectSlide);

    const timer = reduceMotion.matches || heroPaused || heroHovered
      ? undefined
      : window.setInterval(() => heroApi.scrollNext(), 5200);

    return () => {
      heroApi.off("select", selectSlide);
      heroApi.off("reInit", selectSlide);
      if (timer) window.clearInterval(timer);
    };
  }, [heroApi, heroPaused, heroHovered]);

  return (
      <section
        className="hero-slideshow"
        id="top"
        aria-label="Featured meals"
        onMouseEnter={() => setHeroHovered(true)}
        onMouseLeave={() => setHeroHovered(false)}
        onFocusCapture={() => setHeroHovered(true)}
        onBlurCapture={() => setHeroHovered(false)}
      >
        <Carousel
          className="hero-carousel"
          opts={{ loop: true, align: "start" }}
          setApi={setHeroApi}
        >
          <CarouselContent className="hero-carousel-track">
            {heroSlides.map((slide, index) => (
              <CarouselItem className="hero-slide" key={slide.image}>
                <div className="hero-slide-frame">
                  <Image
                    src={slide.image}
                    alt=""
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="hero-slide-image"
                    unoptimized
                  />
                  <div className="hero-vignette" aria-hidden="true" />
                  <div className="hero-slide-copy">
                    <p className="eyebrow">{slide.eyebrow}</p>
                    <h1>{slide.title}</h1>
                    <p>{slide.description}</p>
                    <Button asChild className="hero-cta"><a href="#order-paths">Start your order</a></Button>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hero-arrow hero-arrow-previous" />
          <CarouselNext className="hero-arrow hero-arrow-next" />
          <button
            type="button"
            className="hero-pause"
            onClick={() => setHeroPaused((paused) => !paused)}
            aria-label={heroPaused ? "Play featured meals slideshow" : "Pause featured meals slideshow"}
          >
            {heroPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>
          <div className="hero-dots" aria-label="Choose featured meal">
            {heroSlides.map((slide, index) => (
              <button
                type="button"
                key={slide.image}
                className={activeHeroSlide === index ? "is-active" : ""}
                onClick={() => heroApi?.scrollTo(index)}
                aria-label={`Show slide ${index + 1}: ${slide.title}`}
                aria-current={activeHeroSlide === index ? "true" : undefined}
              />
            ))}
          </div>
        </Carousel>
      </section>
  );
}
