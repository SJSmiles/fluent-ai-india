import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]'
})
export class InfiniteScrollDirective {
  @Output() scrolled = new EventEmitter<void>();

  @HostListener('scroll', ['$event.target'])
  onScroll(target: HTMLElement): void {
    const scrollPosition = target.scrollTop + target.clientHeight;
    const totalHeight = target.scrollHeight;

    // Adjust this threshold as needed
    const scrollThreshold = 100;

    if (totalHeight - scrollPosition < scrollThreshold) {
      this.scrolled.emit();
    }
  }
}
