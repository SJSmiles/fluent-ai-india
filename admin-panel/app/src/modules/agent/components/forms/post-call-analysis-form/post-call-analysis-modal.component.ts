// post-call-analysis-modal.component.ts
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';

export interface PostCallAnalysis {
  name: string;
  description: string;
  examples: string[];
  type?: string;
  required?: boolean;
}

@Component({
  selector: 'app-post-call-analysis-modal',
  templateUrl: './post-call-analysis-modal.component.html',
  styleUrls: ['./post-call-analysis-modal.component.scss']
})
export class PostCallAnalysisModalComponent implements OnInit, OnChanges {
  @Input() analysis: PostCallAnalysis = { name: '', description: '', examples: [] };
  @Input() editingIndex: number | null = null;

  @Output() save = new EventEmitter<{ data: PostCallAnalysis; index: number | null }>();
  @Output() close = new EventEmitter<void>();

  analysisForm!: FormGroup;

  constructor(private fb: FormBuilder) { }

  ngOnInit() {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['analysis'] && this.analysisForm) {
      this.updateForm();
    }
    // Remove show property handling since NgBootstrap modal handles visibility
  }

  initForm() {
    this.analysisForm = this.fb.group({
      name: [
        this.analysis.name || '',
        [Validators.required, Validators.minLength(1), Validators.maxLength(30)]
      ],
      description: [
        this.analysis.description || '',
        [Validators.required, Validators.minLength(1)]
      ],
      type: [this.analysis.type || ''],
      required: [this.analysis.required ?? false],
      examples: this.fb.array(this.analysis.examples.map((example) => this.fb.control(example)))
    });
  }

  updateForm() {
    if (this.analysisForm) {
      this.analysisForm.patchValue({
        name: this.analysis.name || '',
        description: this.analysis.description || '',
        type: this.analysis.type || '',
        required: this.analysis.required ?? false
      });

      // Update examples array
      const examplesArray = this.analysisForm.get('examples') as FormArray;
      examplesArray.clear();
      this.analysis.examples.forEach((example) => {
        examplesArray.push(this.fb.control(example));
      });
    }
  }

  get examplesArray() {
    return this.analysisForm.get('examples') as FormArray;
  }

  addExample() {
    this.examplesArray.push(this.fb.control(''));
  }

  removeExample(index: number) {
    this.examplesArray.removeAt(index);
  }

  onSave() {
    if (this.analysisForm.valid) {
      const formValue = this.analysisForm.value;
      const analysisData: PostCallAnalysis = {
        name: formValue.name.trim(),
        description: formValue.description.trim(),
        examples: formValue.examples.filter((ex: string) => ex.trim() !== ''),
        ...(formValue.type ? { type: formValue.type } : {}),
        ...(formValue.required !== undefined ? { required: formValue.required } : {})
      };

      this.save.emit({ data: analysisData, index: this.editingIndex });
    } else {
      // Mark all fields as touched to show validation errors
      this.analysisForm.markAllAsTouched();
    }
  }

  onClose() {
    this.close.emit();
  }
}
