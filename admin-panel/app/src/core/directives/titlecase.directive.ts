import { Directive, ElementRef, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appTitleCase]'
})
export class TitleCaseDirective implements OnInit, OnChanges {
  @Input() appTitleCase: string | null | undefined;

  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    this.updateText();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appTitleCase']) {
      this.updateText();
    }
  }

  private updateText(): void {
    const formattedText = this.formatToTitleCase(this.appTitleCase);
    this.el.nativeElement.textContent = formattedText;
  }

  private formatToTitleCase(value: string | null | undefined): string {
    if (!value || typeof value !== 'string') {
      return '-';
    }

    return value
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
